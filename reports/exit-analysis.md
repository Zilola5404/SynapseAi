# EXIT ANALYSIS

**Run:** 2026-09-03T22:28:32.298Z

| Stat | Value |
|---|---:|
| Total trades | 108 |
| SL exits | 68 |
| TP exits | 40 |
| TIME exits | 0 |
| Manual exits | 0 |
| Average time in trade | 80.86 h |
| Average MFE | +1.159R |
| Average MAE | -0.886R |
| TIME with MFE ≥ 1R and result < 0.5R | 0 |

TIME means the 24h sim cap was hit before SL or full scale-out. Live has no this cap — TIME is a model artifact to bound MAE/MFE.

## Examples (TIME)

```
```

## Examples (SL)

```
Trade #1  BTCUSDT SHORT A
Entry: 79415.4137
SL: 79923.8313
TP1: 78938.7687
TP2: 78446.2374
TP3: 78279.6313
MFE: +0.050R
MAE: -1.146R
Exit: SL @ 79923.8313
Time in trade: 0.75h
Result: -1.125R
Trade #2  BTCUSDT LONG A
Entry: 88152.7270
SL: 87011.8649
TP1: 89258.3351
TP2: 90381.5702
TP3: n/a
MFE: +0.297R
MAE: -1.002R
Exit: SL @ 87011.8649
Time in trade: 7.00h
Result: -1.061R
Trade #3  BTCUSDT SHORT A
Entry: 112102.0751
SL: 113501.0245
TP1: 110747.9755
TP2: 109371.4510
TP3: n/a
MFE: +0.180R
MAE: -1.016R
Exit: SL @ 113501.0245
Time in trade: 7.33h
Result: -1.060R
Trade #4  BTCUSDT SHORT A
Entry: 110074.7806
SL: 113007.7969
TP1: 107186.0031
TP2: 104275.1062
TP3: n/a
MFE: +0.517R
MAE: -1.014R
Exit: SL @ 113007.7969
Time in trade: 53.92h
Result: -1.017R
Trade #5  BTCUSDT LONG A
Entry: 124875.3701
SL: 124338.1497
TP1: 125362.4503
TP2: 125874.6006
TP3: n/a
MFE: +0.319R
MAE: -1.442R
Exit: SL @ 124338.1497
Time in trade: 1.42h
Result: -1.186R
```

## Examples (TP)

```
Trade #1  BTCUSDT LONG A
Entry: 91374.5713
SL: 88095.8436
TP1: 94616.9564
TP2: 97877.5128
TP3: n/a
MFE: +2.127R
MAE: -0.114R
Exit: TP2 @ 96899.3459
Time in trade: 365.08h
Result: +1.672R
Trade #2  BTCUSDT LONG A
Entry: 102947.1853
SL: 102224.9734
TP1: 103628.2266
TP2: 104329.8532
TP3: n/a
MFE: +1.974R
MAE: -0.085R
Exit: TP2 @ 104119.3652
Time in trade: 1.67h
Result: +1.508R
Trade #3  BTCUSDT LONG A
Entry: 103040.5040
SL: 102224.8801
TP1: 103814.9199
TP2: 104609.9398
TP3: n/a
MFE: +2.217R
MAE: -0.981R
Exit: TP2 @ 104371.4338
Time in trade: 36.92h
Result: +1.494R
Trade #4  BTCUSDT SHORT A
Entry: 113714.3526
SL: 114152.7371
TP1: 113321.4629
TP2: 112905.8258
TP3: 112773.7371
MFE: +2.156R
MAE: -0.652R
Exit: TP3 @ 112977.6815
Time in trade: 12.58h
Result: +1.476R
Trade #5  BTCUSDT SHORT A
Entry: 97210.4540
SL: 99960.0243
TP1: 94488.5757
TP2: 91752.8514
TP3: n/a
MFE: +1.998R
MAE: -0.183R
Exit: TP2 @ 92573.5687
Time in trade: 86.25h
Result: +1.692R
```
