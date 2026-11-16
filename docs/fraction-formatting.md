# Sign fraction renderer

Design reference for the sign-fraction implementation. This build uses the
standard text renderer. The formatting toggle and browser test live with
the fraction implementation.

## Rendering

Sign Fractions defaults to off and is stored with the sign. With the option
off, text uses the original renderer, including the font's `½` glyph when
Enlarge Numerals applies. With the option on, ASCII fractions (`1/2`),
fraction slashes (`1⁄2`), and Unicode fractions (`½`) share the same
renderer. Mixed numbers such as `1 1/2` and `1½` stay together. The editor
and saved model retain the original input string.

Digits inherit the selected sign font, including the resolved Clearview
W/B face. Fraction digits stay at the surrounding letter size. The 150%
numeral setting scales whole numerals to the 15:10 ratio. When numeral
scaling is off, whole numerals share the letter baseline. The renderer
centers fractions and enlarged numerals on the surrounding letter ink.

Overall fraction height is 1.5 times digit height. The diagonal slash
aligns with the numerator top and denominator bottom. The whole-to-fraction
gap is half the whole numeral height. The fraction-to-word gap is 1.25 times
the uppercase letter height. Wider numerators and denominators expand the
fraction box. The row or column layout controls destination table alignment.

The parser skips zero denominators, slash-separated dates, and numeric
fragments inside words. The preview and PNG export share positioned glyphs.
The renderer supports multiline text and exit-tab labels.

## Geometry references

| Reference | Relevant section or dimensions |
| --- | --- |
| [FDOT Design Manual 230 (2026)](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/roadway/fdm/2026/2026fdm230spavtmarkings.pdf) | Section 230.1, MUTCD and FDOT signing standards |
| [MUTCD 11th edition, Part 2A](https://mutcd.fhwa.dot.gov/pdfs/11th_Edition/part2a.pdf) | Section 2A.08 paragraph 14, fraction height and slash alignment |
| [CFX Signing & Pavement Marking Details (2026)](https://www.cfxway.com/wp-content/uploads/2026/03/2026-CFX-SPM-Design-Details.pdf) | Worksheet 101, 10 in digits, 15 in overall and whole numeral heights, 7.5 in numeral gap, 12.5 in word gap, and 20–22 in fraction widths |
| [CFX Sign and Pavement Marking Standards (2014)](https://www.cfxway.com/wp-content/uploads/2015/12/CFX_Sign_Pavement_Stds_Oct_2014.pdf) | Sections 4.6.37–38, proportional widths, spacing, and vertical alignment |

## Verification

In the fraction implementation, serve the app locally and run the browser
test with Playwright and WebKit installed.

```sh
node scripts/test-fractions.cjs http://127.0.0.1:8769
```

The test writes `/tmp/signmaker-fractions.png`.
`PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` selects a local WebKit executable.
