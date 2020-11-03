<template>
    <apexchart
      width="800"
      type="line"
      :options='timeSummaryOptions'
      :series='series'
    ></apexchart>
</template>

<script>
import axios from 'axios'

export default {
  mounted () {
    // this.renderChart(this.chartdata, this.options)
    this.getTimeSummary()
  },
  data: () => ({
    timeSummaryOptions: {
      chart: {
        id: 'area-datetime',
        height: 350,
        zoom: {
          autoScaleYaxis: true
        },
        toolbar: {
          show: false
        }
      },
      dataLabels: {
        enabled: true
      },
      markers: {
        size: 0,
        style: 'hollow',
      },
      xaxis: {
        type: 'datetime',
      },
      stroke: {
        curve: 'smooth'
      },
      title: {
        text: 'Download Count per Day',
        align: 'left'
      },
      grid: {
        borderColor: '#e7e7e7',
        row: {
          colors: ['#f3f3f3', 'transparent'], // takes an array which will be repeated on columns
          opacity: 0.5
        },
      }
    },
    indivSummaryOptions: {
      chart: {
        stacked: true,
      },
      xaxis: {
        type: 'datetime',
      },
      dataLabels: {
        enabled: false
      },
    },
    series: []
  }),
  methods: {
    async getData (lectureId) {
      const data = await axios.get(`/file/${lectureId}`)
      console.log(data)
    },
    async getIndivSummary () {
      const data = (await axios.get('/indivTimeSummary')).data
      const series = {}
      for (const { filename, time, title, count } of data) {
        if (!(filename in series)) {
          series[filename] = { title: "Unknown", data: [] }
        }

        if (title) {
          series[filename].title = title
        }

        series[filename].data.push([new Date(time), count])
      }
      const graphSeries = Object.values(series).map(({ title, data }) => ({ name: title, data }));
      this.series = graphSeries;
    },
    async getTimeSummary () {
      const res = (await axios.get('/timeSummary')).data;
      const seriesData = res.map(({ time, count })=> [new Date(time), count])
      this.series = [{ name: "Download Count", data: seriesData }]
    }
  }
}
</script>

<style>
</style>