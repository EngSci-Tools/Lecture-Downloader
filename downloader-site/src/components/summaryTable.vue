<template>
  <b-table-simple hover bordered>
    <b-thead>
      <b-tr>
        <b-td>Video Name</b-td>
        <b-td>Download Count</b-td>
        <b-td>Uploader</b-td>
      </b-tr>
    </b-thead>
    <b-tbody>
      <b-tr v-for='summary in summaries' :key='summary.filename' @click='open(summary.filename)'>
        <b-td>{{ summary.title || "Unknown" }}</b-td>
        <b-td>{{ summary.count }}</b-td>
        <b-td>{{ summary.username || "Unknown" }}</b-td>
      </b-tr>
    </b-tbody>
  </b-table-simple>
</template>

<script>
import axios from 'axios';

export default {
  name: "SummaryTable",
  data: () => ({
    summaries: []
  }),
  created () {
    this.getSummary()
  },
  methods: {
    async getSummary () {
      const data = (await axios.get(`/summary/20`)).data
      this.summaries = data
    },
    open (filename) {
      window.open(`https://mymedia.library.utoronto.ca/play/${filename}`)
    }
  }
}
</script>