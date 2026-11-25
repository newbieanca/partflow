import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { Empty, Highlight, Pill, Progress, StatusPill } from './ui'
describe('design system components', () => {
  it('Highlight marks matches case-insensitively', () => {
    expect(html(<Highlight text="Wash Motor ABC" tokens={['motor', 'abc']} />)).toBe('Wash <mark class="bg-sharp-soft text-ink rounded-sm px-0.5">Motor</mark> <mark class="bg-sharp-soft text-ink rounded-sm px-0.5">ABC</mark>')
  })
  it('Highlight survives regex special characters and empty tokens', () => {
    expect(() => html(<Highlight text="PART (A+B)" tokens={['(a+', '']} />)).not.toThrow()
    expect(html(<Highlight text="plain" tokens={[]} />)).toBe('plain')
  })
  it('Progress clamps to 0..100', () => {
    expect(html(<Progress value={250} />)).toContain('width:100%')
    expect(html(<Progress value={-5} />)).toContain('width:0%')
    expect(html(<Progress value={42.4} />)).toContain('aria-valuenow="42"')
  })
  it('StatusPill uses semantic labels and tones', () => {
    expect(html(<StatusPill status="OVER_SUPPLY" />)).toContain('Over supply')
    expect(html(<StatusPill status="OVER_SUPPLY" />)).toContain('text-red-700')
    expect(html(<StatusPill status="COMPLETED" />)).toContain('text-green-700')
    expect(html(<StatusPill status="UNKNOWN_X" />)).toContain('UNKNOWN_X')
  })
  it('Pill and Empty render', () => {
    expect(html(<Pill tone="warn">x</Pill>)).toContain('bg-amber-50')
    expect(html(<Empty title="Kosong" hint="petunjuk" />)).toContain('petunjuk')
  })
})
import { BrandImg } from './ui'
describe('BrandImg', () => {
  it('renders an embedded logo (data URI, no file to fetch) with its alt text', () => {
    for (const kind of ['logo', 'wordmark', 'mark', 'sharp'] as const) { const h = html(<BrandImg kind={kind} alt="X" className="h-6" />); expect(h).toContain('src="data:image/webp;base64,'); expect(h).toContain('alt="X"') }
  })
})
