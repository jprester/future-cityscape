I would move from fixed “4 buildings per block” to a simple footprint slot system.

Use each city block as a grid, for example 4×4 slots:

const block = {
slotsX: 4,
slotsZ: 4
}

Then assign building footprints:

residentialSmall: { w: 1, d: 1 } // tiny tower / low-rise
residentialMedium: { w: 2, d: 1 } // slab / compact block
residentialLarge: { w: 2, d: 2 } // big courtyard / U-block
commercialSmall: { w: 2, d: 1 }
commercialLarge: { w: 2, d: 2 }
skyscraper: { w: 4, d: 4 }

So a residential block could contain:

[
small 1x1,
medium 2x1,
small 1x1,
large 2x2,
leftover rooftop/yard/alley space
]

This gives you much more variation while staying simple.

My recommendation:

Residential blocks
Use mixed footprints:

1×1: slim towers, low-rise blocks
2×1: slab blocks
2×2: large residential blocks, U-shaped blocks, courtyard blocks

Commercial blocks
Keep mostly larger:

2×1
2×2
sometimes 4×2 for malls/offices

Skyscraper blocks
Usually:

4×4 single tower
or 2×2 tower + plaza/garage/annex props

Important: you do not need every residential block filled completely. Empty gaps can become:

alley
parking lot
roof-like podium
small plaza
service yard
billboard area

That will actually make the city look more believable from above.

So instead of:

residential block = exactly 4 buildings

I’d use:

residential block = packed randomly with 1×1, 2×1, and 2×2 buildings until 60–90% occupied.

This is probably the best balance between variety, realism, and simple procedural logic.

Square blocks are totally fine for now. I’d keep them and use a 4×4 slot grid internally.

Recommended defaults:

1x1 = small residential tower / low-rise
2x1 = slab block
2x2 = large block / U-shape / courtyard
4x4 = skyscraper / landmark

For residential, use patterns like:

Balanced
[2x2][1][1]
[2x2][2x1]
[ ][ ][2x1]

Dense small
[1][1][1][1]
[1][2x1][1]
[1][ ][ ][1]

Courtyard
[1][ ][2x2]
[1][ ][2x2]
[2x1][2x1][1]

Open / realistic
[1][ ][2x1]
[ ][ ][ ]
[1][1][ ]

My practical rule:

Residential: fill 60–85%
Commercial: fill 70–100%
Skyscraper: one 4x4, or 2x2 tower + podium/plaza
