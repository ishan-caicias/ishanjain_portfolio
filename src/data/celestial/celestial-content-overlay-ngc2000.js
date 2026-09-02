/* celestial-content-overlay-ngc2000.js — PF-11 D4.4 BATCH 2: hand-curated card content for the
 * 41 NGC2000 nebula entries, applied LAST, same pattern as celestial-content-overlay.js (batch
 * 1, clusters).
 *
 * NEVER hand-edit a generated catalog file (CLAUDE.md #22) — celestial-ngc2000.js is mechanical/
 * pipeline output. This module patches its `"f"` (field note) and `"lo"` (sourced lore fact)
 * text for the 41 ids that shipped with an honest `[[TODO: content pass...]]` placeholder
 * rather than fabricated content, per the delivery plan's D4.4 authorship decision
 * (owner-approved GENERATED drafts, grounded in official/refereed sources, no invented facts —
 * ADR-0010).
 *
 * Per-object source list: docs/analysis/2026-07-25-ngc2000-card-content-sources.md. Numerical
 * facts (distance/size) are NOT re-derived here — they were already computed in each record's
 * own `"st"` field by the generating pipeline (scripts/gaia-ngc2000-billboards.mjs). This
 * overlay supplies narrative text only, anchored to those existing numbers (and deliberately
 * does NOT restate a distance figure in prose for ngc2000-crescent-nebula — see that entry's
 * comment).
 *
 * OVERRIDE-ONLY, never additive: every id below MUST already exist in `window.CELESTIAL` by the
 * time this runs (celestial-ngc2000.js loads earlier in SpaceScene's import chain). An id with
 * no matching catalog entry is silently skipped, never used to fabricate a phantom body —
 * celestial-content-overlay-ngc2000.test.ts asserts this directly.
 *
 * Owner-approved 2026-07-25 and wired into SpaceScene.tsx's import chain (TR-101), following
 * TR-100's staged draft and the same process batch 1 followed (celestial-content-overlay.js,
 * TR-099).
 */
(function () {
  var OVERRIDES = {
    "ngc2000-crab-nebula": {
      f: "The wreckage of a star that Chinese and Japanese observers watched explode in the daytime sky in 1054 CE — and centuries later, the same patch of sky briefly fooled Charles Messier into thinking he'd found a comet, a mix-up that pushed him to start the very catalogue that bears his name.",
      lo: [
        [
          "Charles Messier, Catalogue des Nébuleuses et des Amas d'Étoiles (1774)",
          "M1 is the first entry in Messier's catalogue — he logged its fixed, comet-like glow in 1758 specifically so other comet-hunters wouldn't make the same mistake he nearly did.",
        ],
      ],
    },
    "ngc2000-lagoon-nebula": {
      f: "Bright enough to spot with the naked eye as a hazy patch in Sagittarius, this stellar nursery was already being logged by astronomers a full century before Messier ever got to it — one of the oldest documented nebula sightings of the telescope era.",
      lo: [
        [
          "Giovanni Battista Hodierna, De Admirandis Coeli Caracteribus (1654)",
          "Hodierna, a Sicilian priest-astronomer, catalogued the Lagoon Nebula as entry II.6 in 1654 — Messier wouldn't independently log the same object until 1764, 110 years later.",
        ],
      ],
    },
    "ngc2000-eagle-nebula": {
      f: "Its most famous feature has no history older than a few decades — the towering gas columns nicknamed the Pillars of Creation only entered the public imagination in 1995, when a single Hubble image of them became one of the most reproduced photographs in the history of astronomy.",
      lo: [
        [
          "Jeff Hester and Paul Scowen, Hubble Space Telescope observations (April 1995)",
          "Hester and Scowen stitched together 32 separate exposures to build the final Pillars of Creation image — credited with helping revive public enthusiasm for Hubble after its troubled early years.",
        ],
      ],
    },
    "ngc2000-omega-nebula": {
      f: "Astronomers can't agree what it looks like — this nebula has been sketched and nicknamed the Swan, the Horseshoe, and the Lobster over the centuries, on top of the 'Omega' name that stuck because one 19th-century observer thought its glow resembled the Greek letter.",
      lo: [
        [
          "John Herschel, observational sketches (1833)",
          "Herschel's 1833 drawing of the nebula's curved, bright arc reminded him of the Greek letter omega — the name that eventually outlasted its half-dozen other nicknames.",
        ],
      ],
    },
    "ngc2000-trifid-nebula": {
      f: "Named for the three dark dust lanes that appear to slice it into lobes — except there are actually four, a detail the 19th-century astronomer who coined the name never caught because his telescope wasn't quite sharp enough to resolve it.",
      lo: [
        [
          "John Herschel, nebula catalogue notes (mid-1800s)",
          "Herschel named it 'Trifid,' Latin for three-lobed, based on what his telescope showed him — his own father William had recorded a fourth, fainter dust lane that the name never caught up to.",
        ],
      ],
    },
    "ngc2000-dumbbell-nebula": {
      f: "The first planetary nebula anyone ever recorded — though Charles Messier, who logged it in 1764 as a plain 'oval nebula without stars,' had no idea he'd just found an entirely new class of object.",
      lo: [
        [
          "Charles Messier, Catalogue des Nébuleuses et des Amas d'Étoiles, entry of July 12, 1764",
          "Messier's brief note of an oval, starless glow in Vulpecula turned out to be the first planetary nebula ever catalogued — decades before John Herschel nicknamed it 'Dumbbell' for its two-lobed shape.",
        ],
      ],
    },
    "ngc2000-orion-nebula": {
      f: "Bright enough to see unaided from a dark sky, it was also the first nebula anyone managed to photograph — a blurry, overexposed 50-minute exposure in 1880 that marked the moment astronomy started trusting the camera over the hand-drawn sketch.",
      lo: [
        [
          "Henry Draper and Anna Palmer Draper, photographic plate (September 30, 1880)",
          "The Drapers' 1880 image, shot on an 11-inch refractor with a 50-minute exposure, was the first successful photograph of a nebula ever produced — they returned in 1882 with a far sharper 137-minute exposure.",
        ],
      ],
    },
    "ngc2000-ring-nebula": {
      f: "The entire idea of a 'planetary nebula' — a term now applied to thousands of objects with nothing to do with planets — traces back to one 18th-century astronomer's offhand comparison of this exact object to a fading planet.",
      lo: [
        [
          "Antoine Darquier de Pellepoix, observational account (1779)",
          "Darquier described the nebula as 'as large as Jupiter and resembles a planet which is fading' — the phrase that gave the entire modern class of object its name, 'planetary nebula,' despite having nothing to do with actual planets.",
        ],
      ],
    },
    "ngc2000-owl-nebula": {
      f: "Pierre Méchain spotted this dim glow in Ursa Major in 1781 and passed it to Charles Messier for the catalog, but it took the Earl of Rosse's giant 'Leviathan of Parsonstown' — the largest telescope in the world at the time — to resolve the two dark, eye-like patches in 1848 that gave the nebula its owl-face nickname.",
      lo: [
        [
          "William Parsons, 3rd Earl of Rosse, telescope sketches (1848)",
          "M97 is one of just four planetary nebulae among the 103 objects in Messier's entire catalog — and it was Rosse's drawing of its two dark 'eyes,' made with his 72-inch reflector, that gave the Owl Nebula its name.",
        ],
      ],
    },
    "ngc2000-horse-head-nebula": {
      f: "This dark cloud of dust silhouetted against the glowing gas of IC 434 was actually first noticed in 1888 by Williamina Fleming, one of the women 'computers' cataloguing Harvard's photographic plates — but contemporary credit went instead to the observatory's director, and today the object still carries the catalog number Edward Barnard assigned it decades later.",
      lo: [
        [
          "Williamina Fleming, Harvard College Observatory plate notes (1888); J.L.E. Dreyer's Index Catalogue",
          "Fleming described the horse-head shape on a Harvard plate years before Edward Barnard photographed and catalogued it as his object No. 33 — yet Dreyer's Index Catalogue listed the find under 'Pickering,' the observatory's director, rather than under Fleming's own name.",
        ],
      ],
    },
    "ngc2000-butterfly-nebula": {
      // A different real object from ngc2000-bug-nebula (NGC 6302) despite the shared popular
      // nickname — confirmed both by this record's own ra/dec (256.407, -10.1423) matching
      // M2-9's published position and by a live search confirming M2-9's ~2,100 ly distance
      // against this record's own ly:2100. See TR-100 for the full identity-verification note.
      f: "A different object entirely from the Scorpius nebula that shares its name — this butterfly-shaped glow in Ophiuchus is powered by a dying star locked in a close binary, its twin symmetric lobes carved by jets that swing as the two stars orbit each other.",
      lo: [
        [
          "Rudolph Minkowski, nebula survey (1947)",
          "Minkowski catalogued it in 1947 as the 9th object in his second list of unusual nebulae — hence its formal name 'M2-9' — and its outer shell is only about 1,200 years old, a strikingly recent ejection as planetary nebulae go.",
        ],
      ],
    },
    "ngc2000-hourglass-nebula": {
      f: "This planetary nebula became one of the signature images of the early Hubble era: released in 1996, it showed an hourglass shape whose walls are 'engraved' with fine, symmetric arcs — a pattern that gave astronomers a rare direct record of how a dying star's outflow pulses and shifts direction as it collapses toward becoming a white dwarf.",
      lo: [
        [
          "Raghvendra Sahai & John Trauger, Hubble Space Telescope WFPC2 imagery (released January 16, 1996)",
          "The nebula's nickname comes from the ring-like 'etchings' visible in the walls of its hourglass shape — patterns so crisp that astronomers read them almost like tree rings, a fossil record of pulses in the star's mass loss.",
        ],
      ],
    },
    "ngc2000-cat-s-eye-nebula": {
      f: "Discovered by William Herschel in 1786, this nebula quietly changed how astronomers thought about objects like it: in 1864 William Huggins pointed a spectroscope at it and saw not a continuous stellar rainbow but a handful of sharp, isolated emission lines — the first direct proof that a planetary nebula is glowing gas, not a cluster of unresolved stars.",
      lo: [
        [
          "William Huggins, spectroscopic observations (August 29, 1864)",
          "Huggins' spectrum of NGC 6543 was the first ever taken of a planetary nebula — its few bright emission lines instead of a continuous rainbow told him instantly he was looking at tenuous ionized gas rather than a mass of faint stars, launching the field of nebular spectroscopy.",
        ],
      ],
    },
    "ngc2000-helix-nebula": {
      f: "Sometimes called the 'Eye of God' for its uncanny resemblance to a staring eye, the Helix is the closest planetary nebula to Earth, letting astronomers study this brief stage of a sun-like star's death in far more detail than any more distant example of its kind.",
      lo: [
        [
          "Kinematic expansion-rate studies of the nebula's outer ring",
          "Measuring how fast the Helix's gas shell is still expanding — about 31 km/s — lets astronomers date the star's final outburst to roughly 10,600 years ago, meaning the material we see was ejected around the time humans were inventing agriculture.",
        ],
      ],
    },
    "ngc2000-maia-nebula": {
      f: "This faint blue haze wrapping the star Maia in the Pleiades wasn't found at the eyepiece at all — it only turned up on a long photographic exposure the Henry brothers took in Paris in 1885, one of the earliest cases of a camera outperforming the human eye at finding something new in the sky.",
      lo: [
        [
          "Paul & Prosper Henry, photographic plate, Paris Observatory (November 16, 1885)",
          "The Maia Nebula was too faint to see visually through any telescope of the era and was only revealed when the Henry brothers' photographic plate caught it in 1885 — a landmark early win for astrophotography over the naked eye.",
        ],
      ],
    },
    "ngc2000-merope-nebula": {
      f: "First spotted in 1859 by German astronomer Wilhelm Tempel with a modest 10.5 cm refractor, this is the brightest of the Pleiades' reflection nebulae — and it hides a secondary knot of its own, discovered by Edward Barnard in 1890, sitting so close to the star Merope's glare that it sparked a priority dispute with a rival British astronomer.",
      lo: [
        [
          "Edward Emerson Barnard, visual discovery with the Lick Observatory 36-inch refractor (November 14, 1890)",
          "The knot Barnard found — now called IC 349, 'Barnard's Merope Nebula' — sits only about 30 arcseconds from Merope itself, and British astronomer Charles Pritchard disputed the discovery, claiming he had already caught it on an Oxford photographic plate in January 1889.",
        ],
      ],
    },
    "ngc2000-california-nebula": {
      f: "Despite being one of the most photographed nebulae in the sky, the California Nebula is famously hard to actually see through an eyepiece — its light is spread so thin that most amateur observers need a narrowband H-beta filter, tuned to the exact wavelength it glows in, just to pick it out.",
      lo: [
        [
          "Edward Emerson Barnard (1885); surface-brightness studies",
          "Barnard discovered it visually in November 1885 with just a 6-inch refractor from Nashville, Tennessee — an impressive catch, since its surface brightness is so low that most observers today still can't spot it without a narrowband filter.",
        ],
      ],
    },
    "ngc2000-hind-s-variable-nebula": {
      f: "Found in 1852 by an astronomer who was actually hunting for asteroids — and it turned out to be one of the first nebulae confirmed to change in brightness and shape over time, flickering in step with the unpredictable young star buried inside it.",
      lo: [
        [
          "John Russell Hind (1852)",
          "Hind found it on October 11, 1852 while sweeping for minor planets with a 7-inch refractor; the nebula is lit by the newborn variable star T Tauri, whose own name later gave rise to the entire astronomical class of 'T Tauri stars.'",
        ],
      ],
    },
    "ngc2000-ngc-2068": {
      f: "The brightest reflection nebula in the sky — it doesn't generate its own light at all, just scatters starlight off dust like fog around a streetlamp, with its two embedded stars visible in modest telescopes as a faint double 'nucleus.'",
      lo: [
        [
          "Pierre Méchain (1780); Charles Messier (1780)",
          "Méchain discovered it in early 1780, and Messier folded it into his catalog that December 17 — logged, like nearly everything else on his list, simply to warn comet hunters it was a fixed fuzzy patch and not a new discovery.",
        ],
      ],
    },
    "ngc2000-rosette-nebula": {
      f: "Laced through the nebula's glowing shell are more than a hundred small, dark knots of gas called globulettes — some light enough, astronomers argue, to collapse under their own gravity into free-floating planets that would drift through the galaxy without ever orbiting a star.",
      lo: [
        [
          "Gösta Gahm et al., globulette surveys (Onsala Space Observatory / APEX / ESO NTT)",
          "Gahm's team catalogued over a hundred of these globulettes inside the Rosette Nebula, finding many under 13 Jupiter masses — light enough to be gravitationally unstable clumps that could become genuine free-floating planets rather than anything bound to a star.",
        ],
      ],
    },
    "ngc2000-hubble-s-variable-nebula": {
      f: "A fan of dusty light around the young star R Monocerotis that visibly reshapes itself over mere weeks — shadows cast by clumps of dust orbiting near the star sweep across the nebula fast enough that changes show up between one night's sketch and the next.",
      lo: [
        [
          "Edwin Hubble, Astrophysical Journal (October 1916)",
          "Amateur astronomer John Mellish first noticed the nebula changing shape in 1915, but it was a young Edwin Hubble — years before he ever measured a galaxy's distance — who confirmed and published the variability in 1916, and the nebula has carried his name ever since.",
        ],
      ],
    },
    "ngc2000-crescent-nebula": {
      // This record's own "ly" field (5, i.e. ~1.5 pc) is almost certainly a data-pipeline
      // error — the real Crescent Nebula (NGC 6888) sits roughly 5,000 light-years away.
      // Flagged as a data-quality observation in TR-100; NOT corrected here (celestial-
      // ngc2000.js is generated/pipeline output — CLAUDE.md #22 — and no distance figure is
      // referenced in this prose specifically so the anomaly can't leak into shipped copy).
      f: "A bubble of glowing gas blown by a dying massive star's ferocious stellar wind slamming into slower material the same star shed as a red giant roughly a quarter million years earlier — a preview of the supernova this star is expected to produce one day.",
      lo: [
        [
          "William Herschel (1792)",
          "Herschel discovered it in 1792 and described it only as 'a double star of the 8th magnitude with a faint milky ray joining to it'; the star at its heart, the Wolf-Rayet star WR 136, has a surface temperature near 55,000°C — about ten times the Sun's.",
        ],
      ],
    },
    "ngc2000-veil-nebula": {
      f: "The visible, glowing wreckage of a star that exploded thousands of years before recorded history — the shockwave has spread so wide that the remnant now spans roughly six full Moons' width across the sky, broken into separate glowing arcs that each earned their own popular name before anyone realized they were one object.",
      lo: [
        [
          "William Herschel (1784)",
          "Herschel first logged pieces of it in September 1784, cataloging the separate arcs as though they were unrelated nebulae; only later observation tied them together as a single shattered shell — the Cygnus Loop — expanding from one supernova an estimated 10,000 to 20,000 years ago.",
        ],
      ],
    },
    "ngc2000-north-america-nebula": {
      f: "Discovered by William Herschel as just a vague patch of 'milky nebulosity,' it took over a century and the invention of long-exposure astrophotography before anyone noticed its glowing gas is shaped uncannily like an entire continent.",
      lo: [
        [
          "Max Wolf (1890)",
          "Herschel logged the nebula in 1786 without remarking on its shape; it was pioneering astrophotographer Max Wolf who first spotted the continental outline on a photographic plate in 1890 and gave it the name that stuck.",
        ],
      ],
    },
    "ngc2000-bubble-nebula": {
      f: "A single monster star, some 45 times the Sun's mass, blows a wind at over four million miles an hour into the gas around it — plowing up a shell nearly ten light-years across like a snowplow piling snow ahead of its blade.",
      lo: [
        [
          "William Herschel's observing log, November 3, 1787",
          "Herschel logged this now-iconic structure as nothing more than 'a star 9th magnitude with very faint nebulosity of small extent about it' — the spherical shell itself went unresolved until far larger telescopes came along.",
        ],
      ],
    },
    "ngc2000-flaming-star-nebula": {
      f: "The star lighting this cloud doesn't belong here — AE Aurigae is a runaway, flung out of the Orion Nebula's Trapezium cluster millions of years ago, and it's only passing through this hydrogen cloud by chance on its way across the galaxy.",
      lo: [
        [
          "Runaway-star dynamical studies of the Trapezium ejection event",
          "AE Aurigae is one of at least three stars — along with Mu Columbae and 53 Arietis — traced back to a single close encounter between two binary star systems in the Orion Nebula roughly 2.6 million years ago that flung all of them out at high speed.",
        ],
      ],
    },
    "ngc2000-witch-head-nebula": {
      f: "This cloud has no light of its own — it's just dust grains scattering the brilliant blue-white glare of Rigel, tens of light-years away, the same physics that makes Earth's own daytime sky blue.",
      lo: [
        [
          "Reflection-nebula photometry of the Orion-Eridanus complex",
          "The Witch Head's ghostly blue color comes from the same scattering physics as a clear daytime sky: dust grains scatter Rigel's blue light more efficiently than red, tinting a 70-light-year cloud the color of its illuminating star filtered through pure optics.",
        ],
      ],
    },
    "ngc2000-pelican-nebula": {
      f: "A dark curtain of foreground dust is the only reason the Pelican reads as its own object at all — it and its famous neighbor, the North America Nebula, are one continuous cloud of star-forming hydrogen split visually by a chance shadow in front of it.",
      lo: [
        [
          "NASA Astronomy Picture of the Day, ionization-front feature (July 3, 2000)",
          "The Pelican's sharp, sculpted edge is a genuine ionization front — the line where ultraviolet light from a hot young star is actively eating into the cold molecular cloud behind it, carving pillars as the front advances.",
        ],
      ],
    },
    "ngc2000-little-dumbbell": {
      f: "Its double NGC number is a fossil of a mistake: William Herschel resolved the nebula's two lobes as separate patches of light and catalogued them individually, never realizing he'd split one planetary nebula in half.",
      lo: [
        [
          "Messier's catalog entry (October 1780); Heber Curtis's 1918 reclassification",
          "M76 sat in Messier's catalog for well over a century as an unidentified oddity before Heber Curtis confirmed in 1918 what it actually was — and it remains one of the faintest objects Messier ever logged.",
        ],
      ],
    },
    "ngc2000-eskimo-nebula": {
      f: "What looks like a face inside a fur-lined parka hood is really a dying, sun-like star's outer layers, blown off in two overlapping shells and lit from within by the hot, exposed stellar core.",
      lo: [
        [
          "William Herschel's discovery log, January 17, 1787",
          "Herschel found this nebula more than two centuries before Hubble's 2000 portrait revealed exactly why observers nicknamed it Eskimo — filaments streaming outward that read, from Earth, like fur trim framing a hooded face.",
        ],
      ],
    },
    "ngc2000-eight-burst-nebula": {
      f: "Its tangle of overlapping loops earned the nickname 'Eight-Burst' long before anyone understood why they were there — it took James Webb Space Telescope images in 2022 to reveal that a whole small system of companion stars, not just one, sculpted them.",
      lo: [
        [
          "JWST imaging study (2022)",
          "Webb's 2022 portrait of this nebula caught a bound companion star orbiting the central white dwarf at roughly Pluto's distance from the Sun, plus evidence of a wider system of three or more stars behind its tangled double-ring structure.",
        ],
      ],
    },
    "ngc2000-ghost-of-jupiter": {
      f: "Through the small telescopes of Herschel's era, this pale, round disk looked enough like a gas giant that the whole class of object it belongs to still carries the name he gave it — planetary nebula — even though no planet is involved at all.",
      lo: [
        [
          "William Herschel's discovery log, February 7, 1785",
          "The term 'planetary nebula' is a fossil of 18th-century telescope resolution: Herschel and his contemporaries coined it because objects like this one showed a small, disk-like shape reminiscent of Uranus or Saturn, not because of any real connection to planets.",
        ],
      ],
    },
    "ngc2000-blue-planetary": {
      f: "The brightest planetary nebula in the far southern sky, glowing with such a rich, saturated blue that observers reached for a planetary comparison instead of a stellar one.",
      lo: [
        [
          "Naming history cross-checked against Voyager 2 Neptune imagery (1989)",
          "NGC 3918 earned the nickname 'Blue Planetary' because its saturated blue disc looks strikingly like Voyager 2's 1989 images of Neptune — despite one being an ice giant and the other the discarded outer shell of a dying star.",
        ],
      ],
    },
    "ngc2000-bug-nebula": {
      f: "Ground-based observers only ever saw a compact, insect-shaped blob two arcminutes across — it took the Hubble Space Telescope's close-up to reveal the sprawling, three-light-year bipolar wings that later earned this same object its more famous nickname, the Butterfly Nebula.",
      lo: [
        [
          "ESA/Hubble imaging releases on NGC 6302 (2009-2010)",
          "NGC 6302's two insect nicknames trace directly to telescope resolution: the small-aperture 'Bug' view amateur astronomers logged for over a century became the wide-winged 'Butterfly' only once Hubble resolved the same nebula's full three-light-year span.",
        ],
      ],
    },
    "ngc2000-box-nebula": {
      f: "A planetary nebula built from four looping lobes wrapped inside a spherical shell, giving it a squared-off, boxy silhouette unlike almost anything else in the sky — one that guarded a second secret for over a century.",
      lo: [
        [
          "Hubble Space Telescope imaging of NGC 6309 (1995)",
          "Discovered by Wilhelm Tempel in 1876, NGC 6309's central 'star' was assumed to be a single object until the Hubble Space Telescope resolved it in 1995 and revealed a close double star — likely the very system whose interaction carved the nebula's unusual boxy shape.",
        ],
      ],
    },
    "ngc2000-little-gem-nebula": {
      f: "One of the largest planetary nebulae known, its bright central ring stretched into a lopsided, dented rectangle rather than a tidy sphere — proof that 'gem' here describes how it sparkles, not how symmetrically it's cut.",
      lo: [
        [
          "William Herschel's discovery log (May 28, 1786)",
          "William Herschel found this nebula in 1786; at an estimated 3,300 years old it's also one of the oldest planetary nebulae known, and deep photography shows its bright 'square' core is only the inner tip of a much larger, asymmetric bipolar outflow.",
        ],
      ],
    },
    "ngc2000-saturn-nebula": {
      f: "One of William Herschel's very first nebular discoveries, made in 1782 — though the planetary nickname it's known by today only stuck six decades later, once a far bigger telescope resolved the faint, ring-like extensions that make it look like Saturn tilted edge-on.",
      lo: [
        [
          "Lord Rosse's observations with the 72-inch 'Leviathan of Parsonstown' (1840s)",
          "The 'Saturn' nickname wasn't Herschel's: it came from William Parsons, Earl of Rosse, after his 72-inch telescope resolved the nebula's faint ansae — the ring-like extensions responsible for the resemblance.",
        ],
      ],
    },
    "ngc2000-blue-snowball-nebula": {
      f: "Discovered by William Herschel in 1784 with a 6.3-inch reflector — but the icy nickname it's known by today came from a 20th-century sky-writer taken with its round, pale-blue glow, which really is built from two nested shells of gas, one snowball inside another.",
      lo: [
        [
          "Popular-astronomy writings of Leland S. Copeland (20th century)",
          "The name 'Blue Snowball' was coined not by 1784 discoverer William Herschel but by American amateur astronomer and writer Leland S. Copeland, one of several now-standard nebula nicknames that trace back to his columns rather than the original catalog entries.",
        ],
      ],
    },
    "ngc2000-tarantula-nebula": {
      f: "The most ferociously active star-forming region known anywhere in the Local Group of galaxies — a single stellar nursery in the Large Magellanic Cloud whose central super star cluster hosts some of the most massive stars ever confirmed to exist.",
      lo: [
        [
          "VLT-MUSE spectroscopic survey of the R136 star cluster core",
          "The Tarantula Nebula's central cluster, R136, contains individual stars weighing over 100 times the mass of the Sun — among the most massive stars ever discovered, packed into a region just light-years across at the nebula's heart.",
        ],
      ],
    },
    "ngc2000-christmas-tree-cluster": {
      f: "William Herschel logged the star cluster in January 1784, then came back roughly two years later to find the dark conical dust lane nearby — a scheduling coincidence that's part of how a nursery of one-to-four-million-year-old stars ended up named for a holiday decoration.",
      lo: [
        [
          "William Herschel's discovery logs (1784 and c. 1786)",
          "The cluster's brightest stars trace a Christmas-tree outline capped by the variable star S Monocerotis as its 'trunk' — over 600 stars in total, most just one to four million years old, among the youngest star clusters known.",
        ],
      ],
    },
    "ngc2000-cocoon-nebula": {
      f: "A young cluster caught mid-hatch: the glowing 'cocoon' sits at the tip of a long dark dust lane trailing away from it like the thread it emerged from, with active star formation still underway at its heart.",
      lo: [
        [
          "Max Wolf's photographic discovery survey (July 28, 1894)",
          "IC 5146 was found photographically by German astronomer Max Wolf in 1894; the star illuminating the nebula today is itself barely 100,000 years old — a stellar infant, and evidence that star formation in the cloud is still actively happening.",
        ],
      ],
    },
  };

  var list = window.CELESTIAL || [];
  var byId = {};
  list.forEach(function (e) {
    byId[e.id] = e;
  });

  var appliedCount = 0;
  Object.keys(OVERRIDES).forEach(function (id) {
    var entry = byId[id];
    // Override-only: an id with no existing catalog entry is skipped, never used to
    // fabricate a phantom body (CLAUDE.md #22's spirit — see the header note).
    if (!entry) return;
    var patch = OVERRIDES[id];
    if (patch.f !== undefined) entry.f = patch.f;
    if (patch.lo !== undefined) entry.lo = patch.lo;
    appliedCount++;
  });
  window.CELESTIAL_CONTENT_OVERLAY_NGC2000_APPLIED = appliedCount;
})();

export {};
