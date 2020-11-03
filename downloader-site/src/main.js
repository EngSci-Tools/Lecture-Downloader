import Vue from 'vue'
import App from './App.vue'
import VueApexCharts from 'vue-apexcharts'
import { BootstrapVue } from 'bootstrap-vue'
import '@/assets/custom.scss'

Vue.use(BootstrapVue)

Vue.use(VueApexCharts)
Vue.component('apexchart', VueApexCharts)

Vue.config.productionTip = false

new Vue({
  render: h => h(App),
}).$mount('#app')
