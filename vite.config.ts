import {defineConfig} from 'vite';

export default defineConfig({
  server: {
    host:'127.0.0.1',
    fs:{deny:['.env','.env.*','**/.git/**','**/.runtime/**','**/tmp/**','**/docs/**','**/references-private/**']},
  },
  preview:{host:'127.0.0.1'},
});
