# AutoCalibrate-pixinsight
Astronomy files automatic calibration script for PixInsight

---

Скрипт нахождения пересечений множества лайтов к множеству калибровочных мастер-файлов.
Можно сказать, что ближайший родственник этого скрипта - BatchPreprocessing. Однако, у них разные задачи.

Если у вас два астрографа (и даже если один), то без лишних кликов мышкой этот скрипт для каждого лайта найдёт нужный мастер-биас, мастер-дарк и мастер-флет. Более того, после применения косметики и выравнивания фиты будут разложены по папкам в соответствии с объектом и фильтром (C:\ASTRO\M33\L). Bin1 и bin2 будут выравнены по опорному фиту. Его можно самостоятельно разместить в папке объекта (C:\ASTRO\M33\ref.fit) или же будет взят первый фит из серии.

... продолжение следует :)

## Debayer and split-channel processing

Enable **Debayer (VNG)** below Cosmetic Correction to demosaic CFA frames before
ABE, registration, LocalNormalization and SubframeSelector. **Split channels**
continues with three monochrome images (R, G and B); otherwise it continues with
one RGB image. Both options default to off and are saved in application settings
and process instances. Monochrome and already-color frames pass through unchanged.

Supported Bayer patterns are RGGB, BGGR, GBRG and GRBG. The script uses
`CFA:SourcePattern` or `BAYERPAT` metadata with Debayer's Auto mode; legacy files
with a Bayer pattern in `FILTER` use that explicit pattern. Verify CFA metadata
and offsets before processing. Calibration and cosmetic correction still operate
on the mosaic; the saved CosmeticCorrection icon must be configured for CFA data.

Converted images are saved in the configured `DebayerdFolderName` (normally
`debayered`) as XISF, preserving Debayer's sample precision. Names insert `_d_RGB`
or `_d_R`/`_d_G`/`_d_B` before the processing suffix, for example
`light_d_R_c_cc.xisf`. Existing complete outputs can be reused; a missing channel
is regenerated. The second pass resumes conversion before later processing and
keeps the channel signatures separate.

Output `FILTER` metadata is `RGB`, `R`, `G` or `B`; acquisition metadata such as
object and exposure is retained, and CFA metadata is removed. Provide matching
LocalNormalization references under the existing naming convention: a color RGB
reference for RGB output, and monochrome R/G/B references for split output.
Registration keeps the existing object-based reference selection.

### Validation

Run the orchestration regression tests without PixInsight:

```sh
node AutoCalibrate/tests/debayer.test.js
```

These mock the PixInsight API and cover pattern selection, splitting, metadata,
precision, output reuse, failure cleanup, ABE → registration → normalization →
SubframeSelector queuing, second-pass resume, and settings persistence. They do
not validate PixInsight's numerical processing or dialog rendering.

Before production use, run in PixInsight on a small CFA FITS/XISF dataset:

1. Verify the new controls, their persistence, and disabled Split channels control
   when Debayer is off; confirm the existing mono workflow is unchanged.
2. Run VNG with and without splitting. Compare against a manual Debayer VNG run;
   check RGB color balance and each extracted channel's pixels and metadata.
3. Enable ABE, registration, LocalNormalization and SubframeSelector with matching
   references. Confirm each output exists and all expected images are measured.
4. Repeat with cosmetic correction disabled, each path mode, and second pass
   enabled. Delete one channel output and confirm it is recovered on rerun.
5. Check abort/failure handling and both skip-existing and overwrite settings.
