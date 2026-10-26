# PKU split leakage report

**Overall: PASS**
Manifest SHA256: `03cca3b870923a0526623e704960b12a9f7c0a6487c6a5a22412ea6616947481`

Group leakage: 0 groups; pHash Hamming <= 5 cross-split: 0 pairs (all near pairs: 82495); integrity errors: 0.
Quy tắc: group bỏ `_1`/`_2`/`_3` cuối stem; kiểm tra pHash trên mọi ảnh PKU. Nếu FAIL, dừng trước khi tạo data.yaml/train.

pHash là hash toàn ảnh: PCB có layout giống nhau nhưng lỗi khác nhau có thể có khoảng cách nhỏ. PASS ở đây chứng minh không có cạnh pHash <= 5 khác split theo quy tắc đã chọn, không chứng minh mỗi ảnh có board vật lý khác nhau.

## Connected split units (augmentation + pHash)
```text
 images  augmentation_groups     board_prefixes splits
   2416                  421 01, 04, 05, 06, 07  train
    240                   60                 08    val
    240                   60                 09    val
    240                   60                 11   test
    240                   60                 12   test
    128                   32                 10    val
```

## Group leakage examples
```text
[]
```

## Near-duplicate cross-split examples
```text
Empty DataFrame
Columns: [image_a, split_a, image_b, split_b, distance]
Index: []
```

## Integrity issues (first 30)
```text
(none)
```

## Boxes by class and split
```text
                 train  val  test
Missing_hole      1518  508   408
Mouse_bite        1506  504   400
Open_circuit      1410  524   404
Short             1496  496   404
Spur              1482  500   404
Spurious_copper   1530  528   404
```

## COCO size bins @640: counts
```text
        train   val  test
small    8226  2769  2235
medium    714   291   189
large       2     0     0
```

## COCO size bins @640: percent
```text
        train    val  test
small   91.99  90.49  92.2
medium   7.98   9.51   7.8
large    0.02   0.00   0.0
```

