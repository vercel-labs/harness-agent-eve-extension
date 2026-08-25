import { defineExtension } from "eve/extension";
import { z } from "zod";

export default defineExtension({
  config: z.object({
    // Replace with the settings consumers pass at the mount site.
    apiKey: z.string(),
  }),
});
