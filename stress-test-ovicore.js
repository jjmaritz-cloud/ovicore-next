import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 5 },   // warm up
    { duration: "1m", target: 20 },   // normal pressure
    { duration: "1m", target: 50 },   // stronger pressure
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],       // less than 5% failed requests
    http_req_duration: ["p(95)<2000"],    // 95% under 2 seconds
  },
};

const BASE_URL = "https://sandbox.ovicore.com.au";

const pages = [
  "/",
  "/home",
  "/hatchery",
  "/hatchery/chick-availability",
  "/hatchery/egg-receiving",
  "/hatchery/setter-program",
  "/hatchery/hatch-results",
  "/broilers/chick-supply",
  "/broilers/demand-planner",
];

export default function () {
  for (const page of pages) {
    const res = http.get(`${BASE_URL}${page}`);

    check(res, {
      [`${page} status is OK`]: (r) => r.status >= 200 && r.status < 400,
      [`${page} loads under 2s`]: (r) => r.timings.duration < 2000,
    });

    sleep(0.5);
  }
}