# Sign fraction formatting

Sources checked October 24, 2026:

- [FDOT Design Manual 230 (2026)](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/roadway/fdm/2026/2026fdm230spavtmarkings.pdf), 230.1: sign design follows MUTCD and FDOT standards.
- [MUTCD 11th edition, Chapter 2A](https://mutcd.fhwa.dot.gov/pdfs/11th_Edition/part2a.pdf), 2A.08 paragraph 14: diagonal solidus fractions; numerator top and denominator bottom align with solidus ends; overall height is 1.5 times the individual digit height.
- [CFX 2026 Signing & Pavement Marking Details](https://www.cfxway.com/wp-content/uploads/2026/03/2026-CFX-SPM-Design-Details.pdf), guide sign worksheet 101: 10-inch CV4W fraction digits, 15-inch overall height, 15-inch whole number, 7.5-inch whole-to-fraction spacing, 12.5-inch fraction-to-MILE spacing; widths 20 inches for 1/4 and 1/2, 22 inches for 3/4.
- [CFX sign standards (2014)](https://www.cfxway.com/wp-content/uploads/2015/12/CFX_Sign_Pavement_Stds_Oct_2014.pdf), 4.6.37–38: proportional widths (CV4: 2 times digit height for 1/4 and 1/2; CV5: 2.2; 3/4: 2.2), half whole-number-height gap, 1.25 times uppercase-letter-height word gap, vertical centering beside the whole numeral or adjacent destination uppercase letters.

## App behavior

Sign fractions are off by default (Post Settings → Sign Fractions, saved with the sign). Off keeps the original rendering: fractions appear as typed, and with Enlarge Numerals on, `1/2` uses the font's `½` glyph. Everything below describes the setting turned on.

ASCII fractions (`1/2`), fraction slashes (`1⁄2`), and Unicode fractions (`½`) share a renderer. Mixed numbers (`1 1/2`, `1½`) keep the whole numeral and fraction together. The editor and saved sign retain the original text.

Fraction digits inherit the selected sign font, including the resolved Clearview W/B face. They retain the surrounding letter size; optional numeral formatting changes whole numeral size, not fraction digit size. The default 150% numeral setting reproduces the 15:10 whole/digit ratio. With numeral formatting disabled, whole numerals retain their normal size and share the letters' baseline, and the fraction remains vertically centered alongside them. Enlarged numerals and fractions are centered on the letters' ink, not the font's em box, which sits off-center in the Series fonts.

The app applies the CFX proportional gap policy throughout editable sign text, with measured ink heights rather than font em-box heights. It preserves the chosen font rather than forcing every fraction to CV4W. Multi-digit fractions expand to avoid collisions. This is a shared typography policy, not a complete agency-specific sign fabrication layout. CFX destination-table column alignment remains the responsibility of the row/column layout.

Fractions also render in multiline text and remaining editable labels such as exit tabs. Denominator zero, slash-separated dates and numeric fragments embedded in words are not formatted. PNG export uses the same positioned font glyphs as the preview.

## Verification

With Playwright/WebKit installed and the local server running:

```sh
node scripts/test-fractions.cjs http://127.0.0.1:8769
```

Use `NODE_PATH` and `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` when required by the local test setup. The test writes a review screenshot to `/tmp/signmaker-fractions.png`.
