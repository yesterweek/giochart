/*
 * ContextListener 负责监听的控件，并把context传递给Chart
 */
import * as React from "react";
import Aggregate from "./Aggregate";
import Chart from "./Chart";
import {SingleChartProps} from "./ChartProps";
import GrTable from "./GrTable";
class ContextListener extends React.Component <SingleChartProps, any> {
  private static contextTypes: React.ValidationMap<any> = {
    aggregates: React.PropTypes.array,
    columns: React.PropTypes.array,
    extraColumns: React.PropTypes.any,
    selectHandler: React.PropTypes.func,
    selected: React.PropTypes.any,
    source: React.PropTypes.any,
  };

  public render() {
    const chartParams = this.generateChartParams();
    const withAggregate: boolean = ["comparison", "singleNumber"].includes(chartParams.chartType);
    if (!this.context.source || !this.context.source.length) {
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
          <div style={wordStyle}>暂无数据</div>
        </div>
      );
    }
    if (chartParams.chartType === "table") {
      return (
        <GrTable
          chartParams={chartParams}
          source={this.context.source}
          select={this.props.select}
          selected={this.context.selected}
          extraColumns={this.props.extraColumns}
        />
      );
    } else if (withAggregate) {
      return (
        <div className={`gr-chart-wrapper ${chartParams.chartType}`}>
          <Aggregate data={this.context.aggregates} period={this.props.range} />
          <Chart
            chartParams={chartParams}
            colorTheme={this.props.colorTheme}
            source={this.context.source}
            select={this.props.select}
            selected={this.context.selected}
          />
        </div>);
    }else if (chartParams.chartType === "singleNumber") {
      return (
        <div className="gr-chart-wrapper">
          <Aggregate data={this.context.aggregates} period={this.props.range} />
          <Chart
            chartParams={chartParams}
            colorTheme={this.props.colorTheme}
            source={this.context.source}
            select={this.props.select}
            style={{height: "calc(100% - 40px)"}}
            selected={this.context.selected}
          />
        </div>);
    }
    if (chartParams.chartType === "bar") {
      // chartParams
    }
    return (
      <Chart
        chartParams={chartParams}
        source={this.context.source}
        select={this.props.select}
        selected={this.context.selected}
      />
    );
  }
  private generateChartParams() {
    if (this.props.hasOwnProperty("chartParams")) {
      return this.props.chartParams;
    }
    return {
      adjust: this.props.adjust,
      chartType: this.props.chartType,
      colorTheme: this.props.colorTheme,
      columns: this.context.columns,
      granularities: this.props.granularities,
      groupCol: this.props.groupCol
    };
  }
}

export default ContextListener;