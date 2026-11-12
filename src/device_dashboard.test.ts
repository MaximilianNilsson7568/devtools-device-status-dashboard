import assert from "node:assert/strict";
import { decideDashboardState } from "./device_dashboard.js";

const failedRelease = { deviceId: "studio-mac", kind: "release" as const, status: "failed" as const, message: "signed package rejected", accountId: "test-account" };
const passedBuild = { deviceId: "studio-mac", kind: "build" as const, status: "passed" as const, message: "bundle ready", accountId: "test-account" };

assert.equal(decideDashboardState(failedRelease), "attention");
assert.equal(decideDashboardState(passedBuild), "healthy");
console.log("device dashboard decisions: passed");
