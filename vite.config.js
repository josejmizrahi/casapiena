import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa: sirve igual en la raíz de un dominio que en usuario.github.io/repo/
export default defineConfig({ base: "./", plugins: [react()] });
