import Vue from "vue";
import Router from "vue-router";
import VueObserveVisibility from "vue-observe-visibility";

Vue.use(Router);
Vue.use(VueObserveVisibility);

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
