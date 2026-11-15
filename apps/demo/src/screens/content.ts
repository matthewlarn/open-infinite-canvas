/**
 * The content pool for the demo screens. Every string is written for this demo and reads as a real product would:
 * a member-run tool library on Harbor Street. Nothing here is filler text. Long names, accents and non-Latin
 * scripts are included on purpose, because they are what breaks a layout.
 */

export type Tool = {
  name: string;
  category: Category;
  maker: string;
  loanDays: number;
  deposit: number;
  shelf: string;
  blurb: string;
  care: string;
};

export type Category = "Power tools" | "Hand tools" | "Garden" | "Ladders and access" | "Plumbing" | "Electrical" | "Measuring" | "Cleaning";

export const CATEGORIES: Category[] = ["Power tools", "Hand tools", "Garden", "Ladders and access", "Plumbing", "Electrical", "Measuring", "Cleaning"];

export const TOOLS: Tool[] = [
  { name: "Cordless drill driver, 18V", category: "Power tools", maker: "Makita", loanDays: 7, deposit: 20, shelf: "A2", blurb: "Two batteries and a charger in the case. Drives screws into hardwood without stalling.", care: "Return both batteries charged." },
  { name: "Random orbital sander", category: "Power tools", maker: "Bosch", loanDays: 5, deposit: 15, shelf: "A3", blurb: "125mm pad with dust bag. Bring your own discs or buy a pack of ten at the desk.", care: "Empty the dust bag before you bring it back." },
  { name: "Wet tile cutter", category: "Power tools", maker: "Rubi", loanDays: 4, deposit: 30, shelf: "B1", blurb: "Cuts porcelain up to 12mm thick. The water tray stops the blade from overheating.", care: "Drain the tray and wipe the rails dry." },
  { name: "Jigsaw with guide rail", category: "Power tools", maker: "Festool", loanDays: 5, deposit: 25, shelf: "A4", blurb: "Pendulum action for fast cuts in softwood, and a fine setting for laminate.", care: "Blades are consumable. Tell us if one snapped." },
  { name: "Sliding mitre saw, 254mm", category: "Power tools", maker: "DeWalt", loanDays: 3, deposit: 40, shelf: "B4", blurb: "Crosscuts skirting, decking and studwork square. Heavy, so bring a second person or a trolley.", care: "Induction required before first loan." },
  { name: "Angle grinder, 115mm", category: "Power tools", maker: "Metabo", loanDays: 3, deposit: 20, shelf: "B2", blurb: "For cutting bolts, rebar and paving. Guard and side handle are fitted and must stay fitted.", care: "Face shield goes out with it. Bring both back." },
  { name: "Heat gun, two speed", category: "Power tools", maker: "Steinel", loanDays: 5, deposit: 10, shelf: "A5", blurb: "Strips old paint and softens adhesive. Comes with a scraper and three nozzles.", care: "Let it cool on its stand before packing." },
  { name: "Biscuit joiner", category: "Power tools", maker: "Lamello", loanDays: 5, deposit: 25, shelf: "A6", blurb: "Cuts matching slots so panels line up flush. Size 0, 10 and 20 biscuits sold at the desk.", care: "Blow the slot clear of dust after use." },
  { name: "Pressure washer, 140 bar", category: "Cleaning", maker: "Kärcher", loanDays: 2, deposit: 35, shelf: "D1", blurb: "Patio head, lance and an eight metre hose. Weekends book out a fortnight ahead.", care: "Run it dry for ten seconds before coiling the hose." },
  { name: "Wet and dry vacuum, 30L", category: "Cleaning", maker: "Nilfisk", loanDays: 4, deposit: 15, shelf: "D2", blurb: "Lifts plaster dust, sawdust and standing water. A fresh filter is fitted for every loan.", care: "Empty the drum. We wash the filter." },
  { name: "Carpet cleaner", category: "Cleaning", maker: "Bissell", loanDays: 2, deposit: 30, shelf: "D3", blurb: "Does a living room in about forty minutes. Solution is sold separately in one litre bottles.", care: "Rinse both tanks with warm water." },
  { name: "Block plane, low angle", category: "Hand tools", maker: "Veritas", loanDays: 14, deposit: 20, shelf: "C1", blurb: "Trims end grain and eases sharp edges. Sharpened by a volunteer before each loan.", care: "Retract the blade before it goes in the bag." },
  { name: "Set of six bevel chisels", category: "Hand tools", maker: "Narex", loanDays: 14, deposit: 15, shelf: "C2", blurb: "6mm to 32mm in a canvas roll. Honed to 30 degrees and ready to pare.", care: "Never strike with a steel hammer. Use the mallet." },
  { name: "Japanese pull saw", category: "Hand tools", maker: "Gyokucho", loanDays: 14, deposit: 10, shelf: "C3", blurb: "Rip teeth on one edge, crosscut on the other. Cuts on the pull, so let the saw do the work.", care: "Keep the card sleeve on the blade." },
  { name: "Torque wrench, 20 to 110 Nm", category: "Hand tools", maker: "Norbar", loanDays: 7, deposit: 25, shelf: "C5", blurb: "Clicks when the set torque is reached. Checked against our reference twice a year.", care: "Wind it back to the lowest setting to store." },
  { name: "Bolt cutters, 600mm", category: "Hand tools", maker: "Knipex", loanDays: 3, deposit: 15, shelf: "C6", blurb: "Cuts chain and padlock shackles up to 8mm. Photo ID is recorded for this one.", care: "Wipe the jaws with the oiled rag in the case." },
  { name: "Staple gun and brad nailer", category: "Hand tools", maker: "Stanley", loanDays: 7, deposit: 8, shelf: "C4", blurb: "For upholstery, insulation and thin trim. Takes 6mm to 14mm staples.", care: "Unload it before returning." },
  { name: "Pipe wrench, 450mm", category: "Plumbing", maker: "Ridgid", loanDays: 7, deposit: 10, shelf: "E1", blurb: "Bites harder the more you pull. For threaded steel pipe, not chrome fittings.", care: "Close the jaw so it fits the rack." },
  { name: "Drain rods with plunger", category: "Plumbing", maker: "Bailey", loanDays: 3, deposit: 12, shelf: "E2", blurb: "Ten one metre rods. Always turn clockwise or the joints unscrew down the drain.", care: "Hose them down outside. Please." },
  { name: "Pipe slice set, 15 and 22mm", category: "Plumbing", maker: "Monument", loanDays: 7, deposit: 8, shelf: "E3", blurb: "Clean square cuts on copper in a tight space. Three turns is usually enough.", care: "Check the cutting wheels are not chipped." },
  { name: "Radiator bleed and valve kit", category: "Plumbing", maker: "Rothenberger", loanDays: 7, deposit: 6, shelf: "E4", blurb: "Keys for every common valve, a drip tray and a roll of PTFE tape.", care: "Count the keys back in. There are five." },
  { name: "Digital multimeter", category: "Electrical", maker: "Fluke", loanDays: 7, deposit: 20, shelf: "F1", blurb: "Voltage, continuity and resistance. Probes are rated for mains, the user must be too.", care: "Switch it off. The battery is yours to save." },
  { name: "Soldering station, 60W", category: "Electrical", maker: "Hakko", loanDays: 7, deposit: 15, shelf: "F2", blurb: "Temperature holds within a few degrees. Lead free solder and a brass sponge included.", care: "Tin the tip before you switch it off." },
  { name: "Cable and stud detector", category: "Electrical", maker: "Bosch", loanDays: 5, deposit: 15, shelf: "F3", blurb: "Finds live cable, copper pipe and timber studs behind plasterboard.", care: "Recalibrate on a bare wall before each room." },
  { name: "Extension reel, 25m with RCD", category: "Electrical", maker: "Masterplug", loanDays: 7, deposit: 10, shelf: "F4", blurb: "Four sockets and a built in trip. Unwind it fully or it will overheat.", care: "Rewind without kinks." },
  { name: "Cross line laser level", category: "Measuring", maker: "Stabila", loanDays: 5, deposit: 30, shelf: "G1", blurb: "Throws a level line and a plumb line across a whole room. Self levels within four degrees.", care: "Lock the pendulum before moving it." },
  { name: "Moisture meter", category: "Measuring", maker: "Brennenstuhl", loanDays: 7, deposit: 8, shelf: "G2", blurb: "Tells you whether timber or plaster is dry enough to paint.", care: "Cap the pins." },
  { name: "Chalk line and plumb bob", category: "Measuring", maker: "Irwin", loanDays: 14, deposit: 5, shelf: "G3", blurb: "Snaps a straight line across a floor in one go. Blue chalk is refilled at the desk.", care: "Wind the line in fully." },
  { name: "Long reach hedge trimmer", category: "Garden", maker: "Stihl", loanDays: 3, deposit: 30, shelf: "H1", blurb: "Battery powered, with a head that tilts for flat tops. Reaches about three metres.", care: "Brush the blades clean and spray with the oil provided." },
  { name: "Bypass loppers", category: "Garden", maker: "Felco", loanDays: 7, deposit: 10, shelf: "H2", blurb: "Cuts live branches up to 40mm. Sharpened every spring.", care: "Dry the blades if they got wet." },
  { name: "Post hole digger", category: "Garden", maker: "Bulldog", loanDays: 5, deposit: 12, shelf: "H3", blurb: "Two shovels hinged together. Lifts a neat plug of soil for a fence post.", care: "Knock the clay off before it sets." },
  { name: "Wheelbarrow, 90L", category: "Garden", maker: "Haemmerlin", loanDays: 5, deposit: 15, shelf: "Yard", blurb: "Pneumatic tyre, so it rolls over rough ground. Kept in the yard, ask at the desk.", care: "Rinse out concrete straight away." },
  { name: "Lawn scarifier", category: "Garden", maker: "Einhell", loanDays: 2, deposit: 25, shelf: "H5", blurb: "Rakes out moss and thatch. Expect to fill more bags than you think.", care: "Empty the collector and check the tines." },
  { name: "Garden shredder", category: "Garden", maker: "Bosch", loanDays: 2, deposit: 30, shelf: "H6", blurb: "Turns prunings up to 40mm thick into mulch. Quiet enough for a Sunday.", care: "Run it empty for a minute to clear the drum." },
  { name: "Extension ladder, 3.9m", category: "Ladders and access", maker: "Youngman", loanDays: 4, deposit: 25, shelf: "Yard", blurb: "Two section aluminium. Reaches first floor gutters with the stabiliser bar fitted.", care: "Needs a roof rack or a van. It will not fit in a hatchback." },
  { name: "Combination ladder", category: "Ladders and access", maker: "Zarges", loanDays: 5, deposit: 20, shelf: "Yard", blurb: "Stepladder, extension ladder or stair ladder. Locks click when each hinge is safe.", care: "Check all four locks before you climb." },
  { name: "Work platform, 600mm", category: "Ladders and access", maker: "Werner", loanDays: 7, deposit: 12, shelf: "B6", blurb: "A wide stable step for ceilings and coving. Folds flat behind a door.", care: "Wipe paint off the treads." },
  { name: "Sack truck, 200kg", category: "Ladders and access", maker: "Toptruck", loanDays: 3, deposit: 10, shelf: "Yard", blurb: "Moves a washing machine on your own. Straps are in the pocket on the back.", care: "Return the straps." },
  { name: "Caulking gun, heavy duty", category: "Hand tools", maker: "Cox", loanDays: 14, deposit: 5, shelf: "C7", blurb: "Smooth trigger that does not keep running when you stop. Takes standard 310ml cartridges.", care: "Remove the cartridge." },
  { name: "Rivet gun with 200 rivets", category: "Hand tools", maker: "Gesipa", loanDays: 7, deposit: 8, shelf: "C8", blurb: "Four nose pieces for 2.4mm to 4.8mm rivets. Good for gutters and trailer panels.", care: "Tell us roughly how many rivets you used." },
];

export type Member = { name: string; handle: string; since: number; loans: number; role: string };

export const MEMBERS: Member[] = [
  { name: "Amara Okafor", handle: "amara.okafor", since: 2019, loans: 64, role: "Volunteer, Tuesday desk" },
  { name: "Luis Hernández Ortega", handle: "luis.h", since: 2021, loans: 23, role: "Member" },
  { name: "Mei-Ling Zhou", handle: "meiling", since: 2020, loans: 41, role: "Sharpening volunteer" },
  { name: "Siobhán Gallagher", handle: "siobhan.g", since: 2018, loans: 112, role: "Trustee" },
  { name: "Tomasz Wiśniewski", handle: "tomasz.w", since: 2022, loans: 17, role: "Member" },
  { name: "Priya Raman", handle: "priya", since: 2023, loans: 9, role: "Member" },
  { name: "Kofi Mensah", handle: "kofi.mensah", since: 2019, loans: 58, role: "Repair cafe lead" },
  { name: "Élodie Marchand", handle: "elodie.m", since: 2021, loans: 30, role: "Member" },
  { name: "Yusuf Demir", handle: "yusuf.demir", since: 2020, loans: 44, role: "Volunteer, Saturday desk" },
  { name: "Hana Kobayashi", handle: "hana.k", since: 2024, loans: 6, role: "Member" },
  { name: "Александра Кузнецова", handle: "sasha.k", since: 2022, loans: 19, role: "Member" },
  { name: "山田 花子", handle: "hanako", since: 2023, loans: 12, role: "Member" },
  { name: "Nguyễn Thị Minh Khai", handle: "minhkhai", since: 2021, loans: 27, role: "Workshop host" },
  { name: "Hubert Wolfeschlegelsteinhausen-Bergerdorff", handle: "hubert.wb", since: 2017, loans: 203, role: "Founding member" },
  { name: "Aroha Ngata", handle: "aroha", since: 2022, loans: 15, role: "Member" },
  { name: "Ravi Subramaniam", handle: "ravi.s", since: 2020, loans: 38, role: "Electrical safety tester" },
  { name: "Ingrid Sørensen", handle: "ingrid", since: 2019, loans: 71, role: "Treasurer" },
  { name: "Chidi Eze", handle: "chidi", since: 2024, loans: 4, role: "Member" },
  { name: "Fatima al-Sayed", handle: "fatima.as", since: 2021, loans: 33, role: "Member" },
  { name: "Bartholomew Oyelaran-Whitcombe", handle: "bart.ow", since: 2018, loans: 96, role: "Volunteer, yard" },
  { name: "Zoë Papadopoulou", handle: "zoe.p", since: 2023, loans: 11, role: "Member" },
  { name: "Mateus Carvalho", handle: "mateus", since: 2022, loans: 21, role: "Member" },
  { name: "Leilani Kahale", handle: "leilani", since: 2020, loans: 47, role: "Garden tools lead" },
  { name: "Dmitri Volkov", handle: "dmitri.v", since: 2019, loans: 52, role: "Member" },
];

export type Article = { title: string; minutes: number; author: string; standfirst: string; body: string[]; steps: string[] };

export const ARTICLES: Article[] = [
  {
    title: "How to sharpen a chisel that will actually pare",
    minutes: 6,
    author: "Mei-Ling Zhou",
    standfirst: "A chisel is sharp when two flat surfaces meet at a line with no width. Everything below is a way of getting there without rounding it over.",
    body: [
      "Start with the back, not the bevel. Lay the last two centimetres of the back flat on your coarsest stone and work it until the scratch pattern runs right to the edge. You only do this once in the life of the tool, and nothing you do to the bevel will help until it is done.",
      "Set the honing guide so the blade projects 30mm. That gives close to 30 degrees on most guides, which is a good angle for general work in softwood and hardwood alike. Draw the blade back along the stone with light pressure on the edge, eight or ten strokes, then feel for the burr on the back with the pad of your thumb.",
      "A burr along the whole edge means the two surfaces have met. Move to the fine stone and repeat with half the pressure. Then turn the chisel over, lay the back dead flat, and take the burr off in two strokes. Do not lift the handle. Lifting the handle is how a flat back becomes a rounded one.",
      "Test it on the end grain of a scrap of pine. A sharp chisel leaves a surface that shines. A dull one crushes the fibres and leaves it pale and furry. If it is furry, go back to the fine stone. It is nearly always the fine stone.",
    ],
    steps: ["Flatten the back", "Set 30mm projection", "Raise a burr on the coarse stone", "Refine on the fine stone", "Remove the burr flat", "Test on end grain"],
  },
  {
    title: "Bleeding a radiator without flooding the carpet",
    minutes: 4,
    author: "Kofi Mensah",
    standfirst: "If a radiator is hot at the bottom and cold at the top, it has air in it. Letting the air out takes a key, a rag and about a minute.",
    body: [
      "Turn the heating off and wait for the radiators to cool. Bleeding a hot system sprays hot water, and the pump can pull more air in through the open valve while it runs.",
      "The bleed valve is the small square peg at one top corner. Hold the rag under it, fit the key and turn it a quarter turn anticlockwise. You should hear a hiss. That is the air leaving.",
      "When the hiss turns into a steady dribble of water, close the valve. Do not open it further to speed things up. The square peg can come out entirely, and then you have a different afternoon ahead of you.",
      "Check the pressure gauge on the boiler when you have done every radiator. If it has dropped below one bar, top the system up with the filling loop until it reads between one and one and a half.",
    ],
    steps: ["Heating off, radiators cool", "Rag under the valve", "Quarter turn anticlockwise", "Close at the first water", "Check boiler pressure"],
  },
  {
    title: "Hanging a heavy shelf on plasterboard",
    minutes: 7,
    author: "Yusuf Demir",
    standfirst: "Plasterboard is chalk between two sheets of paper. It holds a picture. It does not hold a shelf of cookbooks unless you fix into what is behind it.",
    body: [
      "Find the studs first. Run the detector across the wall at shelf height and mark both edges of each stud in pencil. Studs are usually 400mm or 600mm apart, so once you have found two you can predict the rest.",
      "If a bracket can land on a stud, use a 70mm wood screw straight through the board and into the timber. Nothing else is as strong, and it needs no special fixing.",
      "Where a bracket falls between studs, use a metal hollow wall anchor, not a plastic plug. Drill the hole to the size printed on the anchor, push it in and tighten the screw until the legs spread flat against the back of the board. You will feel it go firm.",
      "Load the shelf gradually over the first day. If a fixing is going to pull, it shows as a hairline crack in the paint around the bracket well before anything falls.",
    ],
    steps: ["Mark the studs", "Screw into timber where you can", "Hollow wall anchors elsewhere", "Level before the last screw", "Load it slowly"],
  },
  {
    title: "Fixing a tap that drips at night",
    minutes: 5,
    author: "Siobhán Gallagher",
    standfirst: "Most dripping taps need a washer that costs less than a stamp. The hard part is getting the tap apart without marking the chrome.",
    body: [
      "Shut off the water at the isolating valve under the sink, or at the stopcock if there is no valve. Open the tap fully to drain what is left in the pipe, and put the plug in so small parts cannot escape.",
      "Lift off the cap on top of the handle and undo the screw beneath it. Wrap a cloth around the chrome shroud before you grip it. With the shroud off you will see a large brass nut. Undo it with an adjustable spanner while you hold the spout steady with your other hand.",
      "The washer sits on the bottom of the part you have just removed, held by a small nut or a press stud. Take the old one to the desk and we will match it. Fit the new one, reassemble in reverse order and turn the water back on slowly.",
    ],
    steps: ["Water off, tap open", "Plug in the sink", "Remove handle and shroud", "Undo the headgear nut", "Swap the washer", "Reassemble and test"],
  },
  {
    title: "Patching a hole in a plasterboard wall",
    minutes: 8,
    author: "Amara Okafor",
    standfirst: "A door handle through the wall looks worse than it is. A patch the size of a saucer takes an evening, most of which is waiting for filler to dry.",
    body: [
      "Cut the damage out to a neat square with a padsaw. A square hole is far easier to fill than a ragged one, because you can cut a patch to match it.",
      "Screw a strip of timber behind the hole so that it bridges the opening, with a screw through the board above and below. This gives the patch something to sit on. Cut a square of plasterboard to fit and screw it to the strip.",
      "Tape the joints with scrim, then spread jointing compound over the tape with a wide filling knife, feathering it out well past the edges. Let it dry fully. Sand lightly, apply a second thinner coat wider than the first, and sand again.",
      "Prime the patch before you paint. Bare filler drinks paint and shows through as a dull square, however many coats you put on top.",
    ],
    steps: ["Square up the hole", "Fix a timber backing strip", "Screw in the patch", "Tape and fill", "Second coat, wider", "Prime, then paint"],
  },
  {
    title: "Laying your first row of tiles straight",
    minutes: 6,
    author: "Nguyễn Thị Minh Khai",
    standfirst: "Walls are not square and neither are baths. If the first row follows either of them, every row above it inherits the error.",
    body: [
      "Do not start from the bottom edge. Fix a straight timber batten to the wall one tile height above the bath, checked with the laser level, and tile upwards from that. The batten carries the weight while the adhesive sets.",
      "Find the centre of the wall and dry lay a row along the batten with spacers. If the last tile at each end would be a thin sliver, shift the whole row by half a tile. Two equal cuts at the ends always look intended.",
      "Spread adhesive over about half a square metre at a time and comb it with the notched edge of the trowel. Press each tile in with a slight twist. Check with the level every third tile, because a small lean becomes a large one by the top of the wall.",
      "Remove the batten the next day and cut the bottom row to fit the gap. This is the only row that has to follow the bath, and nobody looks at it.",
    ],
    steps: ["Level a batten one tile up", "Dry lay from the centre", "Avoid slivers at the ends", "Comb adhesive in small areas", "Check level every third tile", "Fill the bottom row last"],
  },
  {
    title: "Looking after a wooden chopping board",
    minutes: 3,
    author: "Élodie Marchand",
    standfirst: "A board that is oiled a few times a year will outlast the knives. One that goes through the dishwasher will split along a glue line within months.",
    body: [
      "Wash it by hand in hot soapy water and stand it on edge to dry, so that both faces dry at the same rate. A board left flat on a wet counter cups, because one face swells and the other does not.",
      "When water stops beading on the surface, it is time to oil. Use food grade mineral oil, not olive oil, which goes rancid. Flood the surface, leave it for an hour, and wipe off whatever has not soaked in.",
      "Knife scars can be sanded out. Work through 120, 180 and 240 grit with the orbital sander, wipe with a damp cloth to raise the grain, sand once more with 240 and oil it twice.",
    ],
    steps: ["Hand wash, dry on edge", "Oil when water stops beading", "Mineral oil, not cooking oil", "Sand out scars once a year"],
  },
  {
    title: "Choosing the right drill bit for the wall in front of you",
    minutes: 5,
    author: "Ravi Subramaniam",
    standfirst: "The bit matters more than the drill. The wrong one will skate across a tile, burn in hardwood or go blunt in the first centimetre of brick.",
    body: [
      "Brick, block and concrete need a masonry bit, which has a flat carbide tip brazed onto the end, and the drill set to hammer. Start without hammer to make a dimple, then switch it on.",
      "Timber wants a brad point bit. The small spur in the centre stops it wandering, and the outer spurs cut the fibres cleanly before the rest of the bit lifts them out. For holes over 12mm use a flat bit or an auger.",
      "Glazed tile needs a spear point tile bit, no hammer, and patience. Put a cross of masking tape over the mark so the tip cannot slide. Go slowly and stop to let it cool. Once you are through the glaze you can change to a masonry bit for the wall behind.",
      "For metal, use a high speed steel bit at a low speed with a drop of oil. If the swarf comes off blue, you are going too fast.",
    ],
    steps: ["Masonry bit plus hammer for brick", "Brad point for timber", "Tile bit, no hammer, tape cross", "HSS and oil for metal"],
  },
];

export type Workshop = { title: string; host: string; when: string; places: number; taken: number; room: string };

export const WORKSHOPS: Workshop[] = [
  { title: "Sharpening planes and chisels", host: "Mei-Ling Zhou", when: "Thu 19 Nov, 18:30", places: 8, taken: 6, room: "Bench room" },
  { title: "Table saw induction", host: "Hubert Wolfeschlegelsteinhausen-Bergerdorff", when: "Sat 21 Nov, 10:00", places: 4, taken: 4, room: "Machine shop" },
  { title: "Bike brakes: pads, cables and squeal", host: "Kofi Mensah", when: "Sat 21 Nov, 14:00", places: 10, taken: 3, room: "Yard" },
  { title: "Tiling a splashback", host: "Nguyễn Thị Minh Khai", when: "Tue 24 Nov, 18:30", places: 6, taken: 5, room: "Bench room" },
  { title: "Basic wiring for lamps", host: "Ravi Subramaniam", when: "Thu 26 Nov, 18:30", places: 8, taken: 2, room: "Bench room" },
  { title: "Pruning fruit trees in winter", host: "Leilani Kahale", when: "Sun 29 Nov, 11:00", places: 12, taken: 9, room: "Community orchard" },
  { title: "Repair cafe: bring something broken", host: "Kofi Mensah", when: "Sat 5 Dec, 10:00", places: 30, taken: 11, room: "Main hall" },
  { title: "Build a bird box", host: "Amara Okafor", when: "Sun 6 Dec, 13:00", places: 10, taken: 10, room: "Bench room" },
];

export const ACTIVITY: string[] = [
  "returned the wet tile cutter two days early",
  "reserved the pressure washer for Saturday",
  "left a note: the jigsaw needs a new blade clamp",
  "donated a set of sash clamps",
  "passed the mitre saw induction",
  "renewed the cross line laser for three more days",
  "reported a frayed lead on the extension reel",
  "joined the Saturday desk rota",
  "collected the long reach hedge trimmer",
  "paid a late fee of 2.50 on the carpet cleaner",
  "added a photo to the block plane listing",
  "booked a place on the sharpening workshop",
  "returned the sack truck with both straps",
  "asked whether we stock 4mm masonry bits",
  "marked the scarifier as needing new tines",
  "thanked the yard team for the wheelbarrow",
];

export const CHAT: { from: "member" | "desk"; text: string }[] = [
  { from: "member", text: "Hi, is the tile cutter back yet? I have it booked from tomorrow morning." },
  { from: "desk", text: "It came back this afternoon. We are just drying the rails and checking the blade." },
  { from: "member", text: "Great. Does it come with a blade for porcelain or do I need my own?" },
  { from: "desk", text: "The fitted blade is fine for porcelain up to 12mm. If you are cutting natural stone, bring a diamond blade rated for it." },
  { from: "member", text: "Porcelain, 10mm. About four square metres." },
  { from: "desk", text: "That is a comfortable day's work. Keep the tray topped up and let the blade do the cutting." },
  { from: "member", text: "Can I collect before nine? I start work at half past." },
  { from: "desk", text: "The desk opens at eight on Fridays. Ask for Yusuf, he will have it by the door." },
  { from: "member", text: "Perfect, thank you. Do I need to bring ID again?" },
  { from: "desk", text: "No, your membership card is enough. See you at eight." },
  { from: "member", text: "One more thing. Is there a trolley I can borrow to get it to the car?" },
  { from: "desk", text: "Yes, the sack truck is free tomorrow. I have added it to your loan at no charge." },
];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Loans per month for four recent years. Spring and early summer are busy, December is quiet. */
export const LOANS_BY_YEAR: Record<number, number[]> = {
  2023: [212, 238, 301, 388, 441, 462, 430, 397, 352, 309, 251, 168],
  2024: [247, 266, 342, 431, 498, 517, 471, 446, 389, 340, 279, 190],
  2025: [281, 305, 377, 476, 552, 580, 533, 498, 431, 372, 306, 214],
  2026: [309, 338, 419, 521, 603, 637, 588, 547, 470, 411, 340, 0],
};

export const FAQ: { q: string; a: string }[] = [
  { q: "How long can I keep a tool?", a: "Each listing shows its loan period, from two days for the pressure washer to a fortnight for hand tools. You can renew once if nobody is waiting." },
  { q: "What does the deposit cover?", a: "It is held against loss or damage beyond fair wear and comes back when the tool does. Blunt blades and worn sanding pads are fair wear." },
  { q: "Do I need training?", a: "Only for the mitre saw, the table saw and the angle grinder. Inductions run most Saturdays and take about forty minutes." },
  { q: "Can I send someone else to collect?", a: "Yes, if you add them as a named collector on your account first. They will need to show the booking on a phone." },
  { q: "What if something breaks while I have it?", a: "Tell us when you return it. Tools wear out, and we would much rather know than find out on the next loan." },
  { q: "Is there parking?", a: "Two bays in the yard for loading, with a twenty minute limit. The yard gate is on Chandlers Lane, behind the building." },
];

export const OPENING: { day: string; hours: string }[] = [
  { day: "Tuesday", hours: "16:00 to 20:00" },
  { day: "Thursday", hours: "16:00 to 20:00" },
  { day: "Friday", hours: "08:00 to 12:00" },
  { day: "Saturday", hours: "09:30 to 16:00" },
  { day: "Sunday", hours: "10:00 to 13:00" },
];

/** A small deterministic random source, so screen 187 shows the same content on every run. */
export function rng(seed: number) {
  let t = (seed * 2654435761) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(list: T[], seed: number, offset = 0): T {
  return list[(((seed + offset) % list.length) + list.length) % list.length];
}

export function take<T>(list: T[], seed: number, count: number): T[] {
  const out: T[] = [];
  const start = (seed * 5) % list.length;
  /* A step of 7 shares no factor with any list length here, so no item repeats until the list is used up. */
  for (let i = 0; i < count; i++) out.push(list[(start + i * 7) % list.length]);
  return out;
}

export const money = (n: number) => `£${n.toFixed(2)}`;
