<template>
  <Viewer/>
</template>

<script>
import Viewer from './components/Viewer.vue'

export default {
  name: 'App',
  components: {
    Viewer
  }
}
</script>

<style>
body {
  margin: 0;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>
