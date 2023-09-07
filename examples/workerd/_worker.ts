export { default } from './worker/index.js'

// stop auto reload
if (import.meta.hot) {
  import.meta.hot.accept()
}
