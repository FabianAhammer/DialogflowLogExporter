import Vue from "vue";
import Router from "vue-router";
import VueObserveVisibility from "vue-observe-visibility";
import VueVirtualScroller from "vue-virtual-scroller";

Vue.use(Router);
Vue.use(VueVirtualScroller);

export default new Router({
  routes: [
    {
      path: "/",
      name: "landing-page",
      component: require("@/components/LandingPage").default
    },
    {
      path: "*",
      redirect: "/"
    }
  ]
});
