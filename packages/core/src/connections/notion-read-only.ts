import { notionConnection } from "./notion";

/** Builder and app bots only need to read Notion: apps can't call it, and app data lives on the device. */
export default notionConnection({ writes: "refuse" });
