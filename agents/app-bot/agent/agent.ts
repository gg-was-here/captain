import { userModel } from "@captain/core/models";
import { defineAgent } from "eve";

export default defineAgent({
  description: "The assistant for one user-built Captain app: answers questions and edits its on-device data.",
  // The user's default model from Settings → Models.
  model: userModel("default"),
  // The DB client loads a platform-native module, which must ship as a real dependency rather than be bundled.
  build: { externalDependencies: ["@libsql/client"] },
});
