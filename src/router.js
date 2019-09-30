import Vue from 'vue'
import VueMeta from 'vue-meta'
import Router from 'vue-router'
import Home from './views/Home.vue'

Vue.use(Router)
Vue.use(VueMeta)

export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home
    },
    {
      path: '/contest/:id',
      name: 'contest',
      component: () => import(/* webpackChunkName: "contest" */ './views/Contest.vue')
    }
  ]
})
