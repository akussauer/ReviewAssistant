import { defineConfig } from 'vite'

// Builds the Claude Desktop MCP script (src/mcp/server.ts) into one self-contained file,
// out/mcp/server.js, with the MCP SDK and Zod bundled in. Claude Desktop runs it with its
// own Node.js, so nothing from node_modules is available there. The app copies this file
// into the .mcpb bundle (main/mcp/bundle.ts).
export default defineConfig({
  build: {
    ssr: 'src/mcp/server.ts', // a Node build: Node's built-in modules stay external
    outDir: 'out/mcp',
    emptyOutDir: true,
    target: 'node18',
    minify: false,
    rollupOptions: {
      output: { format: 'cjs', entryFileNames: 'server.js', inlineDynamicImports: true }
    }
  },
  ssr: { noExternal: true } // ...but every package is bundled in
})
