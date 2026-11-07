# One Question Later

This handoff consolidates the portfolio discussion through the four corrected isometric studies. Start with the [design and narrative brief](design-and-narrative.md), then use the [case-study copy and interview notes](selected-work.md).

| File | Use |
|---|---|
| [Design and narrative brief](design-and-narrative.md) | Site assessment, decisions in order, positioning, philosophy, layout, typography, and diagram direction |
| [Selected Work](selected-work.md) | Four separate portfolio previews, full stories, lessons, evidence, and publication boundaries |
| [Corrected visual comparison](visuals/isometric-case-studies.png) | All four figures together in the brighter charcoal and grey treatment |
| [Interactive visual study](visuals/isometric-case-studies.html) | Standalone prototype with selectable routes, moving particles, and expandable architecture notes |
| [Typography comparison](type-study/font-comparison.png) | Actual Archivo, Space Grotesk, and Manrope specimens with the same content |
| [Chosen typography specimen](type-study/space-grotesk-specimen.png) | Space Grotesk across an opening statement, project, and timeline moment |

The four reusable vector figures are [document assistant](visuals/document-assistant.svg), [voice receptionist](visuals/voice-receptionist.svg), [invoice processing](visuals/invoice-processing.svg), and [research assistant](visuals/research-assistant.svg).

## Current stage

The conversation progressed from assessment to design planning, case-study copy, and standalone previews. The next implementation pass can place the work near the top of the site and carry the chosen type and visual language through the site. The portfolio has existing in-progress changes. Preserve that work and inspect the current project instructions before implementing.

The corrected comparison image was rendered and visually inspected. The HTML contains the interaction controls and architecture summaries. Browser testing, mobile testing, and the Anatomy audit remain to be done before integrating it into the site.

## Rebuild the vector figures and interactive preview

Run `node portfolio-handoff/source/build.mjs` from the project root. It writes the four SVGs and the HTML preview to `portfolio-handoff/visuals/`. An optional first argument selects a different output folder. The comparison PNG is the saved review render.

The figures use the [Anatomy](https://github.com/wheresryan22/anatomy) kit, included with its [MIT license](source/ANATOMY-LICENSE.txt). [Diagram Design](https://github.com/cathrynlavery/diagram-design) informed the presentation of the optional architecture summaries. Space Grotesk is included with its [font license](source/SPACE-GROTESK-OFL.txt).
