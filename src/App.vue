<template>
  <b-container id="app">
    <router-view/>
  </b-container>
</template>
<script>
export default {
  metaInfo: {
    titleTemplate: `%s :: 评分工具`
  }
}
</script>
<style lang="less">
  body {
    margin: 1em 0;
  }
</style>
