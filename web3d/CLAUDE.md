# The art pipeline

How the Python in `web3d/pixel/` paints, mends and bakes the art. The root `CLAUDE.md` says what each picture is and how
the pages show it; `npm run art` rebuilds it all.

## Mending a pick

A fault in a pick is mended, not repainted:
`web3d/pixel/patch_picks.py` has the model edit a crop round it and keeps only the fault, as an RGBA crop in `picks/`
(its alpha the feathered mask, the place it goes in its PNG) that the bakes paste over the painting (`PATCHES` in `install_picks.py`, `gen_rooms.py`
and `gen_workshop.py`); a thin stray line is filled in code instead (`FILLS` in `install_picks.py`).

## The city

The tower's crane is the roof's yellow at every hour:
`gen_city.py`'s bake recolours it (`yellow_crane`, its shape kept for the depth map) on 4 colours past the city's 64.

`gen_city.py build` writes `city-fx.json` (the bay found in the baked art, only the water the day
art's blue reaches from `BAY_SEED`, so no glint lands on the far shore; and the walks, plazas, lanes and lights in its
`WALKS`, `PLAZAS`, `LANES` and `LIGHTS`), `city-windows.json` (the lit windows, each a whole window grown from its warm
rim, so it goes dark as one; fetched only at night) and copies `city-depth.png` from
`web3d/pixel/paintings/picks/` with the lamp posts and the tree crowns in front of a lane or the walk stood up (`POSTS`, `TREES`, `upright`: a crown as near as its trunk's foot), which `uv run web3d/pixel/depth_map.py city` makes from the dusk pick (it needs torch, so
it is not part of the build: rerun it, and commit its output, when the dusk pick changes).

## The tower's rooms

The rooms
that show outside have a painting at each other hour that changes only the light: the roof an edit of its dusk pick,
whole (`paint_rooms.py retime`); the lobby only through its glass door, one street at every hour, from an edit of a crop
round the door alone that names the street to keep (`paint_rooms.py door`, `DOOR`, at strength 1.0: lower, this model
hardly changes the picture; edited whole, the room got another street at every hour), kept as painted in
`picks/reception-door[-PHASE].png`, of which `install_picks.py` takes only the glass (`DOOR`), its night dulled from the
model's royal blue toward a grey night blue before the colours are cut (`night_view`, `NIGHT`). `gen_floors.py` bakes them into
`floor-{L,R}-NAME.webp`.

The model snows on what is indoors too, so a winter room is its hour's
picture with only `SNOWED` taken from its edit (`install_picks.py`): the roof but its lift housing, the lobby door's
glass but its brass (`unsnow` refills the brass's rows behind the bars).

The roof has open sky for its top slab (`sky_band`): the
painting's own sky at its top blended up, in its own colours and flat bands, into `phases.json`'s sky, its masts carried
on up (mirrored: the one shape that still is, as a lattice reads the same either way) and, at night, its stars
scattered over it.

The lobby has one more picture at each hour,
`floor-L-open[-PHASE].webp`, its glass entrance standing open (cut at `ENTRANCE`), which the push-in from the city lands on:
`paint_rooms.py entrance [--winter] --time PHASE` edits the crop round the doors of that hour's shut lobby (as
`install_picks.painting()` makes it), asked to open the leaves and keep the street seen through them (`ENTRANCE_PROMPT`,
which names it); `entrance [--winter] --time PHASE --pick SEED` puts the pick back under a tight mask on the doorway and
keeps only its crop, `picks/reception-open[-winter][-PHASE].png`, picked only where the street through the opening is the
shut view's; and `gen_floors.py` box-reduces that crop exactly as the whole painting is (the same filter at the same
offset) and bakes it on that hour's lobby colours (`floor-L-open[-winter][-PHASE].webp`).

## The district rooms

The Library, the Radio Mast and the Post Office at another hour are their dusk picks relit (`art_common.relit`), not the
model's edit as painted: asked to change only the light, the model moved the studio's window by 10 art px and the
counter by 5, which would put every FX, the Library's depth map and the reels' boxes off. The edit gives only its light,
blurred over 16 painting px (64 for the Post Office at dawn and night, whose dusk sun shafts `unbeam` takes out first),
its gain capped as a whole so dark warm wood does not go orange by day, the lamps and the fire kept lit. The windows'
glass (`art_common.glass`) takes the hour's view, painted as the lobby's door is: a crop round the windows, at strength
1.0, the view named in the prompt so the model keeps it. Asked only for snow "on the ground", it froze the Post Office's
bay over: its winter prompt keeps the water open.

## The holidays' props

They are `props.webp` and `props.json`,
baked by `web3d/pixel/gen_props.py` (`pose`, `paint`, `unflame`, `key`, `bake`) from `picks/props/`: hanukkiah 11 with its
painted flames erased (the cup tops in `hanukkiah.json`), tree 11 and `tree-plain`, tree 11 with its snow painted off,
each box-reduced to ~30 and 34 art px on 32 colours with a hard edge.

Each burst is painted once on black (burst-gold,
-red, -green and -blue, seed 13 each) and grown and faded from it in `BURST_FRAMES`, a pixel lit where its light passes
`LIT` of its full bloom's (`fireworks.webp`, `fireworks.json`). gen_props.py's `pose`, `paint`, `key` and `bake` do these
too (`key NAME SEED` keys every frame of a ghost or the bat), and the bake skips a set until all its picks are in.

## Workshop Row

Its walkers are painted people: `web3d/pixel/gen_walkers.py` draws 8 walk-cycle poses from a skeleton (`pose`), Draw Things
repaints them as each of six people with one seed apiece (`paint`), and `bake` turns the picked frames in
`web3d/pixel/paintings/picks/walkers/NAME_K.png` into `walkers.webp` (a row per person, a frame per column) and
`walkers.json`, a person 60 art px tall (`PERSON`, against the street's ~100 px roller doors).

The kerb lamp at x 245, painted dark at every hour, is lit by
`gen_workshop.py` (`relight`) at every hour but day. The
lamp posts in `workshop-depth.png` are stood up by `gen_workshop.py` (`upright`): the model fades their thin poles into the
wall as they rise, and a whole post must hide a walker passing behind it.
