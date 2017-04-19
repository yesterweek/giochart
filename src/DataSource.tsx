/***
 * 文档
 */
import { assign, flatten, isEqual, map, zipObject, zipWith } from "lodash";
import * as React from "react";
import * as DataCache from "./DataCache";
import {DataLoaderProps, DataRequestProps, Metric, ResponseParams, Source} from "./ChartProps";
// declare function fetch(a: any, b?: any): any;
declare const project: any;
// 数据统计必备字段，中端需要以下字段提供数据
export const HttpStatus = {
  Ok                  : 200,
  Created             : 201,
  NoContent           : 204,
  MovedPermanently    : 301,
  SeeOther            : 303,
  NotModified         : 304,
  BadRequest          : 400,
  Unauthorized        : 401,
  Forbidden           : 403,
  NotFound            : 404,
  MethodNotAllowed    : 405,
  NotAcceptable       : 406,
  RequestTimeout      : 408,
  UnsupportedEntity   : 422,
  Locked              : 423,
  TooManyRequests     : 429,
  InternalServerError : 500,
  NotImplemented      : 501
};
type NumberArray = Array<number|null>;
class DataSource extends React.Component <DataLoaderProps, any> {
  private static childContextTypes: React.ValidationMap<any> = {
    aggregates: React.PropTypes.array,
    columns: React.PropTypes.array,
    selectHandler: React.PropTypes.func,
    selected: React.PropTypes.any,
    source: React.PropTypes.any
  };
  private tryTimes = 0;
  private startTime = 0;
  private trackWords = {
    channel_name: "",
    board_name: ""
  };
  private constructor(props: DataLoaderProps) {
    super(props);
    // 加载状态
    this.state = {
      aggregates: null,
      columns: null,
      error: false,
      selected: null,
      source: null
    };

  }

  public render() {
    if (this.state.error) {
      const outerStyle = {
        "-webkit-box-orient": "vertical",
        "-webkit-box-pack": "center",
        "display": "-webkit-box",
        "height": "100%"
      };
      const wordStyle = {
        color: "#999999",
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center"
      };
      return (
        <div style={outerStyle}>
          <div style={wordStyle}>加载失败</div>
        </div>
      );
    } else if (!this.state.source) {
      return (
        <div className="gr-loading-mask">
          <div className="loading-gif" />
        </div>
      );
    }
    return React.Children.only(this.props.children);
  }
  // TODO: 用来给子孙节点中的GrChart自定义 Demo props state改变触发 DataSource取数据返回触发
  private getChildContext() {
    return {
      aggregates: this.state.aggregates,
      columns: this.state.columns,
      selected: this.state.selected,
      source: this.state.source
      /*,
       selectHandler: this.selectHandler.bind(this)
       */
    };
  }
  private componentWillReceiveProps(nextProps: DataLoaderProps) {
    // TODO status改变也会触发，所以多了一层判断
    if (JSON.stringify(this.props.params) !== JSON.stringify(nextProps.params)) {
      if (nextProps.hasOwnProperty("cacheOptions")) {
        const chartDataInCache = DataCache.getChartData(nextProps.params, nextProps.hashKeys);
        if (chartDataInCache) {
          this.setState(chartDataInCache);
          return;
        }
      }
      this.startTime = Date.now();
      this.defaultRequest(nextProps.params, this.afterFetch.bind(this));
    }
  }

  // 动态变化Dimension
  /* defaultRetryRequest() {
   let {chartParams} = this.props;
   let result = Promise.reject();
   for (let i = 3; i > 0; i--) {
   result = result.catch(this.defaultRequest.bind(this, chartParams, this.drawChart));
   }
   return result;
  } */
  private defaultRequest(chartParams: DataRequestProps, callback: any) {
    const vds = window._vds;

    let fetchObj;
    // Todo 检查是否是DEV环境
    if (this.props.hasOwnProperty("sourceUrl")) {
      fetchObj = fetch(this.props.sourceUrl);
    } else {
      fetchObj = fetch(`/v4/projects/${project.id}/chartdata`, {
        body: JSON.stringify(chartParams),
        credentials: "same-origin",
        /*contentType: "application/json",*/
        method: "post",
      });
    }
    fetchObj.then((response: any) => {
      const status = response.status;
      if (status === HttpStatus.Ok) {
        this.tryTimes = 0;
        return response.json();
      } else if (status === HttpStatus.RequestTimeout && this.tryTimes < 2) {
        this.tryTimes++;
        setTimeout(this.defaultRequest.bind(this, chartParams, callback), 200);
      } else {
        this.setState({
          error: true
        });
        console.log("report_load_fail");

        vds.track("report_load_fail", {
          project_id: window.project.id,
          chart_name: chartParams.name,
          board_name: this.trackWords.board_name,
          report_load_time: Date.now() - this.startTime,
          channel_name: this.trackWords.channel_name
        });
      }
    }).then((data: ResponseParams) => callback(data)).catch((e: any) => void(0));
  }

  private componentWillMount() {
    const { params } = this.props;
    const trackWords = location.pathname.match(/\/projects\/\w{8}\/([^\/]+)\/([^\/]+)/);
    if (trackWords.length > 2) {
      this.trackWords = {
        channel_name: trackWords[1],
        board_name: trackWords[2]
      };
    }

    if (this.props.hasOwnProperty("cacheOptions")) {
      const chartDataInCache = DataCache.getChartData(params, this.props.hashKeys);
      if (chartDataInCache) {
        this.setState(chartDataInCache);
        return;
      }
    }
    this.startTime = Date.now();
    this.defaultRequest(params, this.afterFetch.bind(this));
  }

  private afterFetch(chartData: ResponseParams) {
    let columns = chartData.meta.columns;
    let colIds = map(chartData.meta.columns, "id");
    const offset = chartData.meta.offset;
    // any是因为下面的zipWith返回的schema有bug
    let sourceData: any = chartData.data;

    // 为了支持周期对比图，这里需要meta的offset 转化
    if (chartData.meta.offset !== undefined) {
      // 寻找粒度
      const offsetPeriod = (7 * 86400000);
      // 强行配对，没验证...
      sourceData = zipWith(
        sourceData.slice(0, offset),
        sourceData.slice(offset),
        (thisTurn: NumberArray, lastTurn: NumberArray): NumberArray =>
          (thisTurn || [lastTurn[0] + offsetPeriod, null]).concat(lastTurn));
      // 加上下划线表示上一周期的字段
      colIds = colIds.concat(map(colIds, (n: string) => (n + "_")));
      // 取得Metric ID
      columns[1].name = "当前周期";
      columns = columns.concat(map(columns,
        (n: Metric) => assign({}, n, {
          id: n.id + "_",
          name: n.isDim ? undefined : "上一周期"
        })
      ));
    }
    let source: Source = map(sourceData, (n: number[]) => zipObject(colIds, n));

    // 强行添加转化率
    if (this.props.params.attrs && this.props.params.attrs.isAddFakeMetric) {
      const lastCol = columns[columns.length - 1];
      lastCol.name += "转化率";
      lastCol.isRate = true;
      const id = lastCol.id;
      source.forEach((n: any) => {
        if (n["9yGbpp8x"]) {
          n[id] /= n["9yGbpp8x"];
        } else {
          n[id] = undefined;
        }
      });
    }

    // 加载成功，打点
    if (!source || source.length === 0) {
      console.log("report_no_data");
      try {
        const vds = window._vds;
        vds.track("report_no_data", {
          project_id: window.project.id,
          chart_name: this.props.params.name,
          board_name: this.trackWords.board_name,
          report_load_time: Date.now() - this.startTime,
          channel_name: this.trackWords.channel_name
        });
      } catch(e) {

      }
    }

    const state = {
      aggregates: chartData.meta.aggregates,
      columns,
      error: false,
      source
    };
    if (this.props.hasOwnProperty("cacheOptions")) {
      DataCache.setChartData(this.props.params, state, this.props.hashKeys, this.props.cacheOptions);
    }

    this.setState(state);
    if (this.props.onLoad) {
      this.props.onLoad(this.state);
    }
  }
}

export default DataSource;
