import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root";
import { Route as loginRoute } from "./routes/login";
import { Route as appRoute } from "./routes/_app";
import { Route as dashboardRoute } from "./routes/_app/index";
import { Route as tasksRoute } from "./routes/_app/tasks";
import { Route as habitsRoute } from "./routes/_app/habits";
import { Route as projectsRoute } from "./routes/_app/projects";
import { Route as notesRoute } from "./routes/_app/notes";
import { Route as calendarRoute } from "./routes/_app/calendar";
import { Route as graphRoute } from "./routes/_app/graph";
import { Route as searchRoute } from "./routes/_app/search";
import { Route as analyticsRoute } from "./routes/_app/analytics";
import { Route as agentsRoute } from "./routes/_app/agents";
import { Route as agentActivityRoute } from "./routes/_app/agents/activity";
import { Route as dailyRoute } from "./routes/_app/daily";
import { Route as settingsRoute } from "./routes/_app/settings";
import { Route as taskDetailRoute } from "./routes/_app/tasks/$id";
import { Route as habitDetailRoute } from "./routes/_app/habits/$id";
import { Route as noteDetailRoute } from "./routes/_app/notes/$id";
import { Route as projectDetailRoute } from "./routes/_app/projects/$id";

const appChildren = [
  dashboardRoute,
  tasksRoute,
  habitsRoute,
  projectsRoute,
  notesRoute,
  calendarRoute,
  graphRoute,
  searchRoute,
  analyticsRoute,
  agentsRoute,
  agentActivityRoute,
  dailyRoute,
  settingsRoute,
  taskDetailRoute,
  habitDetailRoute,
  noteDetailRoute,
  projectDetailRoute,
];

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren(appChildren),
]);

export const router = createRouter({ routeTree });
export { routeTree };
