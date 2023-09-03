import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <div>
      <output id="output"></output>
      <button id="get">Get</button>
    </div>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)

document.querySelector('#get')!.addEventListener('click', async () => {
  const output = document.querySelector<HTMLInputElement>('#output')!
  const res = await fetch('/api/foo')
  const content = await res.text()
  output.value = content
})
