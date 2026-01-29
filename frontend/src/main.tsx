import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { initUiScale } from "@/utils/uiScale";
import App from "./App";

initUiScale();

const container = document.getElementById("root");

const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
