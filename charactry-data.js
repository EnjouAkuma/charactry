/**
 * ============================================================
 *  CHARACTRY DATA FILE  —  charactry-data.js
 *  Edit this file freely to add names, species, breeds, etc.
 *  The main app reads window.GEN_DATA and window.PROMPT_TEMPLATES
 * ============================================================
 *
 *  NAME STRUCTURE:
 *    GEN_DATA.names[style][gender]  →  array of strings
 *    gender keys: "m" (male), "f" (female), "n" (neutral)
 *    surnames are in GEN_DATA.surnames[style]
 *
 *  SPECIES STRUCTURE:
 *    GEN_DATA.species[Category].sub  →  array of strings
 *
 *  TRAITS:
 *    GEN_DATA.traits  →  flat array of strings
 *
 *  PROMPTS:
 *    PROMPT_TEMPLATES[Language]  →  array of strings (use {name} as placeholder)
 * ============================================================
 */

window.GEN_DATA = {

  /* ----------------------------------------------------------
     NAMES  —  organised by style then gender
     Add your own names to any array, or add a whole new style!
  ---------------------------------------------------------- */
  names: {

    fantasy: {
      m: ['Aelindros','Zyrith','Caelum','Thalos','Voryn','Serath','Kaelis','Dravon','Orvyn','Auren',
          'Tyvel','Zephiel','Kaelith','Draeven','Nyrath','Elyndor','Sorath','Vexan','Mordaen','Ilvaryn',
          'Caldris','Rhaevar','Solmire','Duskren','Vaelthor','Xevran','Nython','Erevan','Ghauven','Aseryn'],
      f: ['Aelindra','Vexara','Sorel','Lyriel','Ithara','Solenne','Myrith','Solvara','Nyxen','Elyndra',
          'Kaelin','Vesara','Thalara','Aevrin','Solaena','Lyriael','Nyxara','Dawneth','Iraeva','Zephyra',
          'Sylvara','Vaelith','Astriel','Maerath','Calindra','Eiris','Illyndra','Solveig','Nyrith','Rhaewyn'],
      n: ['Eiryn','Azryn','Lyren','Soren','Kael','Vesper','Talon','Riven','Skye','Zhen',
          'Auren','Maren','Lyrith','Caeren','Thrix','Velith','Azen','Nyrel','Sorel','Draen'],
    },

    japanese: {
      m: ['Haruki','Renjiro','Touma','Shinji','Kaito','Ryuu','Asahi','Yukio','Kei','Tatsuya',
          'Hiroshi','Makoto','Sora','Akio','Daichi','Kenji','Naoki','Ren','Satoshi','Takumi',
          'Yusuke','Hayato','Riku','Izumu','Shunsuke','Taro','Ichiro','Masaru','Noboru','Shouta'],
      f: ['Mizuki','Tsukino','Aoi','Kazue','Nami','Koharu','Izumi','Hotaru','Yua','Satsuki',
          'Hikari','Yuki','Akira','Miharu','Haruna','Sakura','Rin','Hana','Yuna','Ayaka',
          'Kasumi','Natsuki','Sora','Himari','Kotone','Ruri','Shiho','Tomoe','Yuuka','Akane'],
      n: ['Sora','Ren','Kei','Nao','Tomo','Haru','Aki','Yuu','Nori','Sei',
          'Chihiro','Makoto','Kaoru','Minori','Reiji','Shiori','Tsuki','Natsu','Fuyu','Hoshi'],
    },

    gothic: {
      m: ['Draven','Lucian','Noctis','Valdris','Malachar','Corvine','Ebrath','Aldric','Grimthorn','Vayne',
          'Crestfall','Mortis','Ashvere','Severyn','Obsidian','Thanis','Nocturne','Vexmoor','Caligath','Dreadmoor',
          'Sable','Ravenmere','Sepulvain','Dunveil','Vesperan','Hexen','Cravenmoor','Darkthorn','Ebonmir','Wrathmoor'],
      f: ['Morrigan','Seraphine','Isadora','Elara','Thessaly','Sylvara','Noctara','Vespertine','Elowen','Sombra',
          'Raven','Mortisia','Ashgrave','Ebonrose','Noxara','Crestwyn','Ravenna','Bellatrix','Grimoire','Helewys',
          'Vespera','Nocturna','Umbria','Nachtmare','Solveil','Wraithe','Mourna','Duskwyn','Vesperine','Corvina'],
      n: ['Vesper','Raven','Ash','Mourne','Nox','Grave','Sable','Dusk','Hex','Wraith',
          'Crypt','Onyx','Vex','Omen','Dirge','Pyre','Mortis','Umbra','Shade','Bleak'],
    },

    nature: {
      m: ['Ash','Reed','Flint','Thorn','Stone','Birch','Cedar','Rowan','Bramble','Gale',
          'Cliff','River','Hawk','Wolf','Bear','Elk','Pike','Drake','Bram','Wren',
          'Slate','Crag','Fern','Lichen','Oak','Hazel','Alder','Moss','Bog','Fen'],
      f: ['Briar','Fern','Clover','Sage','Lark','Meadow','Ember','Hazel','Brook','Wren',
          'Willow','Ivy','Rose','Lily','Violet','Heather','Poppy','Daisy','Iris','Clover',
          'Saffron','Flora','Wisteria','Blossom','Petal','Vines','Brynn','Dew','Mist','Dawn'],
      n: ['Sky','Storm','Dusk','River','Rain','Frost','Leaf','Tide','Gust','Ember',
          'Fen','Glen','Vale','Cove','Moor','Haze','Drift','Glow','Rime','Ash'],
    },

    modern: {
      m: ['Arlo','Pax','Zion','Wyatt','Blake','Devon','Beckett','Cael','Harlow','Vex',
          'Knox','Axel','Ryder','Jaxon','Zane','Bryce','Crew','Dex','Finn','Grey',
          'Hunter','Jace','Kai','Leo','Miles','Nash','Owen','Quinn','Rex','Slade'],
      f: ['Alex','Riley','Morgan','Avery','Quinn','Sage','Reese','Sloane','Monroe','Indigo',
          'Nova','Rue','Sable','Marlowe','Harlow','Blaire','Cleo','Eden','Faye','Gemma',
          'Harper','Isla','Jade','Kira','Luna','Mia','Nora','Olive','Piper','Remi'],
      n: ['Jordan','Casey','Pax','Zion','Avery','Blake','Sable','Rue','Cael','Vex',
          'Scout','Reeve','Linden','Emery','Shae','True','West','Vale','Lyric','Indigo'],
    },

    divine: {
      m: ['Solarius','Caelith','Zeraphon','Theonyx','Urithel','Vorath','Aelior','Pyrael','Celestar','Ithael',
          'Zael','Aurantiel','Solaeon','Auranis','Thelanis','Lumanor','Heliodor','Aurivael','Ilyar','Goldenmere',
          'Seraphel','Caelthorn','Divaeus','Glorivael','Solanthus','Aethon','Valenar','Radiel','Thornhalo','Brightmane'],
      f: ['Astariel','Miravel','Aevara','Seraphis','Calyndra','Velindra','Lumael','Naevyn','Celeste','Auranis',
          'Divael','Goldenhalo','Seraphira','Lumielle','Astriel','Caelindra','Solaena','Radiance','Aurelia','Dawnveil',
          'Solira','Celindra','Aetheria','Gloriana','Iluminara','Caelith','Stariel','Lumara','Heliara','Brightwyn'],
      n: ['Zael','Ithael','Aurel','Soliel','Caelvyn','Lumel','Serel','Aevyn','Pyriel','Celith',
          'Radiel','Gloryn','Vael','Sorel','Lumyn','Divin','Auren','Therel','Goldyn','Starvyn'],
    },

    demonic: {
      m: ['Malphas','Zorith','Azrex','Baelron','Vorzyn','Demorix','Abadox','Kalarix','Vergeth','Razix',
          'Daemon','Vrothis','Kaleth','Morthex','Abyxen','Velzath','Razithar','Hexaron','Sythrex','Nythrael',
          'Mordrex','Ketharon','Vexathar','Grimveil','Ashbrand','Necrothis','Hellvex','Doomweave','Bloodpact','Voidreap'],
      f: ['Kethara','Nyxara','Nythara','Hexara','Nyskara','Verath','Soreth','Sythren','Vorzyn','Abadoxia',
          'Malphasra','Hexarix','Nyxariel','Kethwyn','Hellara','Demorixia','Vexara','Sythara','Ashbrandis','Nyxveil',
          'Grimara','Hellvexia','Abyssara','Doomsara','Voidwyn','Necrowyn','Soulvex','Cursara','Damnwyn','Hexveil'],
      n: ['Nyxen','Vex','Hex','Doom','Ash','Void','Soul','Grim','Hell','Abyss',
          'Keth','Sythr','Vorzyn','Demorix','Razix','Velzath','Abadox','Morthex','Vergeth','Nythara'],
    },

  },

  /* ----------------------------------------------------------
     SURNAMES  —  by style
  ---------------------------------------------------------- */
  surnames: {
    fantasy:  ['Ashveil','Dawnmere','Stormcroft','Blackthorn','Ironcrest','Voidwalker','Moonshade','Emberveil',
                'Starfall','Duskholm','Frostweave','Grimhallow','Silverthorn','Nightveil','Ashcrown','Sunderfeld',
                'Ravenmoor','Goldenwick','Coldwater','Dunehaven','Stormveil','Ironmoor','Ashfen','Bloodcroft'],
    japanese: ['Fujiwara','Aoyama','Tachibana','Kuriyama','Watanabe','Himura','Nakamura','Katsuragi','Shirogane',
                'Hayashida','Asakura','Minamoto','Kurosaki','Takasugi','Izumo','Shinomiya','Otonashi','Kisaragi',
                'Hanemiya','Ryuugamine','Tokugawa','Yagami','Uzumaki','Sohma','Kuchiki','Fuyutsuki','Yamazaki'],
    gothic:   ['Blackwood','Ashcroft','Morvaine','Dreadmore','Grimstone','Corvinus','Nightshade','Holloway',
                'Ravencroft','Mortlake','Sepulvain','Dunveil','Belfry','Ashmoore','Vespertine','Darkholm',
                'Ravenholm','Sable','Mortis','Duskwood','Grimthorn','Hexenmoor','Eboncroft','Wrathmere'],
    nature:   ['Greenfield','Thornwood','Riverstone','Cloudberry','Mossbank','Wildmere','Stonecroft','Driftwood',
                'Fernhollow','Clearwater','Oakvale','Bramble','Rainsford','Hillcrest','Windhollow','Dustfield',
                'Brookside','Hawkmere','Ashwood','Cliffton','Pinebrook','Stoneback','Meadowsweet','Fernridge'],
    modern:   ['Hayes','Monroe','Calloway','Vega','Cruz','Mercer','Sterling','Beckett','Hollis','Whitmore',
                'Adler','Navarro','Ashton','Blaine','Harmon','Colt','Rayne','Decker','Kessler','Thorne',
                'Colby','Graves','Hendrix','Lockwood','Remington','Tanner','Voss','Wilder','Yorke','Zane'],
    divine:   ['of Aethermoor','of the First Light','the Undying','Celestborn','Lightweaver','of Elysium',
                'Soulfire','the Ascended','Dawnbringer','Starborn','the Eternal','of Solace','Goldenhalo',
                'the Sanctified','Voidbane','of the High Choir','Luminarch','the Radiant','Sungiven','Holymere'],
    demonic:  ['of the Abyss','the Devourer','Hellborn','Soulreaper','the Damned','Blackflame','Voidtouched',
                'the Wretched','Doomweaver','the Cursed','Bloodpact','Grimveil','the Forsaken','Ashbrand',
                'Hexborn','of Perdition','the Flayed','Ruinborn','Netherspawn','of Eternal Torment'],
  },

  /* ----------------------------------------------------------
     SPECIES  —  with detailed subspecies/breeds
     Format: Category: { sub: [ 'Subspecies 1', 'Subspecies 2', ... ] }
     You can add as many subspecies as you want per category!
  ---------------------------------------------------------- */
  species: {

    'Demon': {
      sub: ['Archdemon','Hell Howler','Imp','Incubus','Succubus','Vesparii','Pit Fiend',
            'Shadow Wraith','Brimstone Demon','Chain Demon','Abyssal Demon','Gluttony Demon',
            'Wrath Demon','Lust Demon','Envy Demon','Sloth Demon','Pride Demon','Greed Demon',
            'Soul Collector','Hellhound Shifter','Bone Demon','Infernal Knight','Slag Demon',
            'Smoke Wraith','Torment Demon','Chaos Imp','Ember Fiend','Frozen Demon','Storm Demon',
            'Plague Demon'],
    },

    'Angel': {
      sub: ['Archangel','Cherubim','Common Angel','Dominion','Fallen Angel','Powers',
            'Principalities','Seraphim','Thrones','Virtues','Grigori (Watcher)',
            'Guardian Angel','Angel of Death','Angel of Mercy','Angel of War',
            'Celestial Herald','Radiant Angel','Storm Angel','Void Angel','Iron Angel'],
    },

    'Nephilim':  { sub: ['Nephilim (Angel × Human)','Half-Nephilim','Ancient Nephilim','Cursed Nephilim'] },
    'Nephalem':  { sub: ['Nephalem (Angel × Demon)','Greater Nephalem','Lesser Nephalem'] },
    'Cambion':   { sub: ['Cambion (Demon × Human)','Greater Cambion','Lesser Cambion','Cursed Cambion'] },

    'Vampire': {
      sub: ['Nosferatu','Dhampir','High Vampire','Blood Mage Vampire','Shadow Vampire',
            'Ancient Vampire','Cursed Vampire','Daywalker','Feral Vampire','Strigoi',
            'Revenant Vampire','Storm Vampire','Blood Prince/Princess','Void Vampire',
            'Sea Vampire','Ember Vampire','Plague Vampire','Dream Vampire'],
    },

    'Fae': {
      sub: ['High Fae','Pixie','Sprite','Brownie','Kelpie','Sluagh','Banshee','Dullahan',
            'Leannán Sídhe','Puck','Changeling','Will-o-Wisp','Nixie','Selkie (Fae-touched)',
            'Redcap','Hobgoblin','Spriggan','Clurichaun','Bean Sídhe','Merrow'],
    },

    'Ghoul': {
      sub: ['Ghoul','Lesser Ghoul','Royal Ghoul','Sand Ghoul','Grave Ghoul',
            'Flesh Ghoul','Bone Ghoul','Shadow Ghoul','Ancient Ghoul','Plague Ghoul'],
    },

    'Human': {
      sub: ['Human','Half-Blood Human','Enhanced Human','Mutant Human','Cursed Human',
            'Ancient Human','Gifted Human','Hunter (Human)','Witch-Blooded Human',
            'Blessed Human','Seer Human','Feral Human'],
    },

    'Alien': {
      sub: ['Grey','Reptilian Alien','Insectoid Alien','Crystalline Alien','Gaseous Entity',
            'Hive Mind Alien','Aquatic Alien','Energy Being','Fungal Alien','Silica-Based Alien',
            'Shapeshifter Alien','Parasitic Alien','Mechanical Alien','Plant-Based Alien',
            'Void Entity','Luminescent Alien','Multi-Dimensional Alien','Swarm Alien'],
    },

    /* ── DEMIHUMAN — Mammals ── */
    'Demihuman — Canine': {
      sub: [
        'Demihuman — German Shepherd','Demihuman — Husky','Demihuman — Shiba Inu',
        'Demihuman — Golden Retriever','Demihuman — Border Collie','Demihuman — Dobermann',
        'Demihuman — Rottweiler','Demihuman — Akita','Demihuman — Malinois',
        'Demihuman — Great Dane','Demihuman — Samoyed','Demihuman — Australian Shepherd',
        'Demihuman — Dalmatian','Demihuman — Greyhound','Demihuman — Basenji',
        'Demihuman — Dingo','Demihuman — Wolf-Dog Hybrid','Demihuman — Arctic Wolf Mix',
      ],
    },
    'Demihuman — Feline': {
      sub: [
        'Demihuman — Lion','Demihuman — Tiger','Demihuman — Leopard','Demihuman — Snow Leopard',
        'Demihuman — Cheetah','Demihuman — Jaguar','Demihuman — Cougar','Demihuman — Ocelot',
        'Demihuman — Serval','Demihuman — Caracal','Demihuman — Lynx','Demihuman — Clouded Leopard',
        'Demihuman — Domestic Cat (Tabby)','Demihuman — Domestic Cat (Calico)',
        'Demihuman — Domestic Cat (Siamese)','Demihuman — Black Panther',
      ],
    },
    'Demihuman — Vulpine': {
      sub: [
        'Demihuman — Red Fox','Demihuman — Arctic Fox','Demihuman — Fennec Fox',
        'Demihuman — Gray Fox','Demihuman — Silver Fox','Demihuman — Black Fox',
        'Demihuman — Kit Fox','Demihuman — Marble Fox','Demihuman — Bat-Eared Fox',
      ],
    },
    'Demihuman — Equine': {
      sub: [
        'Demihuman — Arabian Horse','Demihuman — Andalusian','Demihuman — Friesian',
        'Demihuman — Clydesdale','Demihuman — Mustang','Demihuman — Thoroughbred',
        'Demihuman — Lipizzaner','Demihuman — Appaloosa','Demihuman — Shire Horse',
        'Demihuman — Zebra','Demihuman — Donkey','Demihuman — Mule',
      ],
    },
    'Demihuman — Cervine': {
      sub: [
        'Demihuman — White-Tailed Deer','Demihuman — Red Deer','Demihuman — Elk/Wapiti',
        'Demihuman — Moose','Demihuman — Reindeer/Caribou','Demihuman — Fallow Deer',
        'Demihuman — Sika Deer','Demihuman — Roe Deer','Demihuman — Muntjac',
      ],
    },
    'Demihuman — Ursine': {
      sub: [
        'Demihuman — Brown Bear','Demihuman — Polar Bear','Demihuman — Black Bear',
        'Demihuman — Grizzly Bear','Demihuman — Giant Panda','Demihuman — Red Panda',
        'Demihuman — Sun Bear','Demihuman — Spectacled Bear','Demihuman — Spirit Bear',
      ],
    },
    'Demihuman — Rabbit/Lagomorph': {
      sub: [
        'Demihuman — Holland Lop','Demihuman — Flemish Giant','Demihuman — Rex Rabbit',
        'Demihuman — Angora Rabbit','Demihuman — Harlequin Rabbit','Demihuman — Jackrabbit',
        'Demihuman — Snowshoe Hare','Demihuman — Pika','Demihuman — Cottontail',
      ],
    },
    'Demihuman — Dragon': {
      sub: [
        'Demihuman — Western Dragon','Demihuman — Eastern Dragon','Demihuman — Sea Dragon',
        'Demihuman — Ice Dragon','Demihuman — Fire Dragon','Demihuman — Storm Dragon',
        'Demihuman — Shadow Dragon','Demihuman — Wyvern','Demihuman — Amphithere',
        'Demihuman — Lindworm','Demihuman — Drake (Wingless)','Demihuman — Lung Dragon',
      ],
    },
    /* ── DEMIHUMAN — Reptile ── */
    'Demihuman — Reptile': {
      sub: [
        'Demihuman — Komodo Dragon','Demihuman — Monitor Lizard','Demihuman — Iguana',
        'Demihuman — Chameleon','Demihuman — Gecko (Crested)','Demihuman — Gecko (Leopard)',
        'Demihuman — Bearded Dragon','Demihuman — Blue-Tongue Skink',
        'Demihuman — King Snake','Demihuman — Corn Snake','Demihuman — Ball Python',
        'Demihuman — Boa Constrictor','Demihuman — King Cobra','Demihuman — Reticulated Python',
        'Demihuman — Anaconda','Demihuman — Rattlesnake','Demihuman — Viper',
        'Demihuman — Alligator','Demihuman — Saltwater Crocodile','Demihuman — Gharial',
      ],
    },
    /* ── DEMIHUMAN — Amphibian ── */
    'Demihuman — Amphibian': {
      sub: [
        'Demihuman — Axolotl','Demihuman — Tiger Salamander','Demihuman — Fire Salamander',
        'Demihuman — Giant Salamander (Japanese)','Demihuman — Mudpuppy',
        'Demihuman — Poison Dart Frog','Demihuman — Tomato Frog','Demihuman — Glass Frog',
        'Demihuman — Tree Frog (White\'s)','Demihuman — Pacman Frog','Demihuman — Bullfrog',
        'Demihuman — Caecilian',
      ],
    },
    /* ── DEMIHUMAN — Avian ── */
    'Demihuman — Avian': {
      sub: [
        'Demihuman — Bald Eagle','Demihuman — Golden Eagle','Demihuman — Harpy Eagle',
        'Demihuman — Peregrine Falcon','Demihuman — Red-Tailed Hawk','Demihuman — Osprey',
        'Demihuman — Great Horned Owl','Demihuman — Barn Owl','Demihuman — Snowy Owl',
        'Demihuman — Common Raven','Demihuman — Jackdaw','Demihuman — Magpie',
        'Demihuman — Peacock','Demihuman — Flamingo','Demihuman — Toucan',
        'Demihuman — Macaw (Scarlet)','Demihuman — Macaw (Blue-and-Gold)',
        'Demihuman — Cockatoo','Demihuman — Cockatiel','Demihuman — African Grey Parrot',
        'Demihuman — Bat (Fruit Bat)','Demihuman — Bat (Vampire Bat)',
      ],
    },
    /* ── DEMIHUMAN — Aquatic Mammal ── */
    'Demihuman — Aquatic Mammal': {
      sub: [
        'Demihuman — Bottlenose Dolphin','Demihuman — Orca','Demihuman — Beluga Whale',
        'Demihuman — Narwhal','Demihuman — Humpback Whale','Demihuman — Blue Whale',
        'Demihuman — Sperm Whale','Demihuman — Harbour Seal','Demihuman — Leopard Seal',
        'Demihuman — Walrus','Demihuman — Sea Otter','Demihuman — Manatee','Demihuman — Dugong',
      ],
    },

    /* ── MERFOLK — by fish type ── */
    'Merfolk — Freshwater': {
      sub: [
        'Merfolk — Koi','Merfolk — Betta Fish','Merfolk — Goldfish','Merfolk — Arowana',
        'Merfolk — Discus Fish','Merfolk — Oscar Fish','Merfolk — Axolotl Mer',
        'Merfolk — Sturgeon','Merfolk — Piranha','Merfolk — Electric Eel',
        'Merfolk — Catfish','Merfolk — Carp','Merfolk — Trout','Merfolk — Salmon',
      ],
    },
    'Merfolk — Reef': {
      sub: [
        'Merfolk — Clownfish','Merfolk — Lionfish','Merfolk — Angelfish (Marine)',
        'Merfolk — Moorish Idol','Merfolk — Butterfly Fish','Merfolk — Parrotfish',
        'Merfolk — Triggerfish','Merfolk — Pufferfish','Merfolk — Seahorse Mer',
        'Merfolk — Mandarin Fish','Merfolk — Scorpionfish','Merfolk — Grouper',
      ],
    },
    'Merfolk — Deep Sea': {
      sub: [
        'Merfolk — Anglerfish','Merfolk — Oarfish','Merfolk — Coelacanth',
        'Merfolk — Gulper Eel','Merfolk — Viperfish','Merfolk — Barreleye',
        'Merfolk — Vampire Squid Mer','Merfolk — Bioluminescent Mer','Merfolk — Dragonfish',
        'Merfolk — Fangtooth Mer','Merfolk — Hatchetfish',
      ],
    },
    'Merfolk — Open Ocean': {
      sub: [
        'Merfolk — Great White Shark','Merfolk — Hammerhead Shark','Merfolk — Whale Shark',
        'Merfolk — Blue Shark','Merfolk — Mako Shark','Merfolk — Manta Ray',
        'Merfolk — Sting Ray','Merfolk — Barracuda','Merfolk — Swordfish',
        'Merfolk — Marlin','Merfolk — Tuna','Merfolk — Moray Eel',
        'Merfolk — Sea Dragon (Leafy)','Merfolk — Sea Dragon (Weedy)',
      ],
    },

    /* ── ANTHROPOMORPHIC — by animal group ── */
    'Anthropomorphic — Canine': {
      sub: [
        'Anthro — German Shepherd','Anthro — Husky','Anthro — Shiba Inu',
        'Anthro — Golden Retriever','Anthro — Border Collie','Anthro — Dobermann',
        'Anthro — Rottweiler','Anthro — Malinois','Anthro — Great Dane',
        'Anthro — Australian Shepherd','Anthro — Dalmatian','Anthro — Greyhound',
        'Anthro — Samoyed','Anthro — Akita','Anthro — Dingo','Anthro — Wolf',
        'Anthro — Arctic Wolf','Anthro — Black Wolf','Anthro — Timber Wolf',
      ],
    },
    'Anthropomorphic — Feline': {
      sub: [
        'Anthro — Lion','Anthro — Tiger','Anthro — Leopard','Anthro — Snow Leopard',
        'Anthro — Cheetah','Anthro — Jaguar','Anthro — Cougar','Anthro — Serval',
        'Anthro — Caracal','Anthro — Lynx','Anthro — Ocelot','Anthro — Black Panther',
        'Anthro — Clouded Leopard','Anthro — Tabby Cat','Anthro — Calico Cat',
        'Anthro — Siamese Cat','Anthro — Maine Coon','Anthro — Ragdoll Cat',
      ],
    },
    'Anthropomorphic — Vulpine': {
      sub: [
        'Anthro — Red Fox','Anthro — Arctic Fox','Anthro — Fennec Fox',
        'Anthro — Gray Fox','Anthro — Silver Fox','Anthro — Black Fox',
        'Anthro — Kit Fox','Anthro — Marble Fox','Anthro — Bat-Eared Fox',
      ],
    },
    'Anthropomorphic — Ursine': {
      sub: [
        'Anthro — Brown Bear','Anthro — Polar Bear','Anthro — Black Bear',
        'Anthro — Grizzly Bear','Anthro — Giant Panda','Anthro — Red Panda',
        'Anthro — Sun Bear','Anthro — Honey Badger','Anthro — Raccoon',
        'Anthro — Coati','Anthro — Wolverine',
      ],
    },
    'Anthropomorphic — Avian': {
      sub: [
        'Anthro — Eagle','Anthro — Raven','Anthro — Owl','Anthro — Hawk',
        'Anthro — Falcon','Anthro — Peacock','Anthro — Crow','Anthro — Magpie',
        'Anthro — Parrot','Anthro — Toucan','Anthro — Flamingo','Anthro — Bat',
        'Anthro — Cockatoo','Anthro — Macaw','Anthro — Vulture','Anthro — Heron',
      ],
    },
    'Anthropomorphic — Reptile': {
      sub: [
        'Anthro — Crocodile','Anthro — Alligator','Anthro — Komodo Dragon',
        'Anthro — Monitor Lizard','Anthro — Chameleon','Anthro — Gecko',
        'Anthro — Iguana','Anthro — King Cobra','Anthro — Ball Python',
        'Anthro — Rattlesnake','Anthro — Sea Turtle','Anthro — Snapping Turtle',
        'Anthro — Bearded Dragon','Anthro — Frilled Lizard',
      ],
    },
    'Anthropomorphic — Misc': {
      sub: [
        'Anthro — Hyena','Anthro — Deer','Anthro — Rabbit','Anthro — Skunk',
        'Anthro — Otter','Anthro — Ferret','Anthro — Weasel','Anthro — Badger',
        'Anthro — Platypus','Anthro — Echidna','Anthro — Kangaroo','Anthro — Wombat',
        'Anthro — Shark','Anthro — Dolphin','Anthro — Octopus','Anthro — Moth',
        'Anthro — Dragonfly','Anthro — Mantis','Anthro — Spider','Anthro — Scorpion',
      ],
    },

    /* ── DEITY / GOD ── */
    'Deity/God': {
      sub: [
        'God of War','God of Death','God of Life','God of Love','God of Chaos',
        'God of Order','God of Time','God of Nature','God of the Sea','God of Fire',
        'God of Ice','God of Dreams','God of Fate','God of Light','God of Darkness',
        'God of Knowledge','God of Art','God of Music','God of the Hunt',
        'God of the Moon','God of the Sun','God of Storms','God of the Harvest',
        'God of Grass','God of Forgotten Things','God of Silence','God of Doors',
        'God of Small Joys','God of Thresholds','God of Borrowed Things',
        'God of Lost Things','God of Endings','God of Beginnings','God of Entropy',
        'God of Memory','God of Deceit','God of Justice','God of Plague',
        'God of Healing','God of the Void','God of Stars','God of Rivers',
        'God of Mountains','God of Beasts','God of the Forge','God of Shadows',
        'Demigod','Trickster God','War God (Minor)','Patron Saint (Divine)','Idol God',
      ],
    },

    /* ── FAE EXPANDED ── */
    'Fae — Court': {
      sub: ['Seelie Court Fae','Unseelie Court Fae','Wild Fae','Shadow Court Fae',
            'Autumn Court Fae','Winter Court Fae','Spring Court Fae','Summer Court Fae',
            'Night Court Fae','Dawn Court Fae'],
    },
  },

  /* ----------------------------------------------------------
     TRAITS  —  add as many as you want
  ---------------------------------------------------------- */
  traits: [
    // Positive
    'Adventurous','Ambitious','Artistic','Calm','Charismatic','Cheerful','Clever',
    'Compassionate','Courageous','Devoted','Disciplined','Empathetic','Forgiving',
    'Gentle','Honorable','Humorous','Inquisitive','Kind','Loyal','Nurturing',
    'Optimistic','Patient','Playful','Pragmatic','Strategic','Sympathetic',
    'Tenacious','Thoughtful','Wise','Witty',
    // Negative
    'Arrogant','Brash','Cynical','Greedy','Headstrong','Hot-headed','Impulsive',
    'Jealous','Lazy','Manipulative','Paranoid','Reckless','Stubborn','Suspicious',
    'Vengeful',
    // Complex / Mixed
    'Analytical','Brooding','Competitive','Cunning','Dramatic','Eccentric',
    'Enigmatic','Ethereal','Fierce','Flirtatious','Grim','Intense','Melancholic',
    'Mischievous','Mysterious','Naive','Oblivious','Obsessive','Perfectionist',
    'Proud','Reserved','Sarcastic','Sardonic','Secretive','Self-sacrificing',
    'Sensitive','Stoic','Territorial','Timid','Unpredictable','Volatile',
    'Whimsical','Wistful','Zealous','Detached','Reclusive','Fatalistic',
    'Superstitious','Idealistic','Nihilistic','Chaotic','Lawful','Hedonistic',
    'Ascetic','Curious','Cautious','Daring','Dramatic','Nostalgic','Restless',
    'Seductive','Solemn','Tormented','Unhinged','Visionary','Wrathful',
  ],

};

/* ============================================================
   WRITING PROMPTS
   Format: { Language: [ 'prompt with optional {name}' ] }
   Add new languages or prompts freely!
============================================================ */
window.PROMPT_TEMPLATES = {

  English: [
    'Your character must confront someone from their past.',
    'Write a scene where {name} discovers a long-kept secret.',
    '{name} wakes up in an unfamiliar place with no memory of how they got there.',
    'Someone challenges {name}\'s deepest-held belief.',
    '{name} must choose between their loyalty and their morals.',
    'Write about the day everything changed for {name}.',
    '{name} receives a gift they never expected.',
    'A stranger claims to know {name}\'s true name.',
    '{name} is forced to work with their greatest enemy.',
    'Write about {name}\'s happiest memory and why it haunts them.',
    '{name} finds a door that shouldn\'t exist.',
    'Someone tells {name} they are not who they think they are.',
    '{name} must say goodbye to something they love.',
    'Write a scene from {name}\'s childhood that shaped who they are.',
    '{name} discovers they have been lied to for years.',
    'A prophecy about {name} comes true — in the worst way.',
    '{name} meets someone who reminds them of who they used to be.',
    'Write the moment {name} finally snapped.',
    '{name} is given one hour to live. What do they do?',
    'Something {name} thought was gone forever comes back.',
    '{name} has to keep a secret that could destroy everything.',
    'Write about a moment {name} almost gave up.',
    '{name} is recognized by someone they\'ve never met.',
    'Two sides of {name}\'s life collide at the worst possible moment.',
    '{name} breaks their own most important rule.',
    'Write about {name} standing at the edge of a decision they can\'t undo.',
    '{name} is offered exactly what they always wanted — at a terrible price.',
    'Someone from {name}\'s past returns, and they\'re not the same person they were.',
    'Write {name}\'s last letter to someone they love.',
    'The one thing {name} swore they\'d never do — they\'re about to do it.',
  ],

  Spanish: [
    '{name} debe enfrentarse a alguien de su pasado.',
    'Escribe una escena donde {name} descubre un secreto bien guardado.',
    '{name} despierta en un lugar desconocido sin recordar cómo llegó.',
    'Alguien desafía la creencia más profunda de {name}.',
    '{name} debe elegir entre su lealtad y su moral.',
    'Escribe sobre el día en que todo cambió para {name}.',
    '{name} recibe un regalo que nunca esperó.',
    'Un extraño afirma conocer el verdadero nombre de {name}.',
    '{name} debe trabajar con su mayor enemigo.',
    'Escribe sobre el recuerdo más feliz de {name} y por qué lo atormenta.',
    '{name} encuentra una puerta que no debería existir.',
    'Alguien le dice a {name} que no es quien cree ser.',
    '{name} debe despedirse de algo que ama.',
    '{name} descubre que le han mentido por años.',
    'Escribe el momento en que {name} finalmente se rompió.',
    '{name} recibe exactamente lo que siempre quiso — a un precio terrible.',
  ],

  French: [
    '{name} doit confronter quelqu\'un de son passé.',
    'Écris une scène où {name} découvre un secret bien gardé.',
    '{name} se réveille dans un endroit inconnu sans souvenir.',
    'Quelqu\'un remet en question la conviction la plus profonde de {name}.',
    '{name} doit choisir entre sa loyauté et sa morale.',
    'Écris à propos du jour où tout a changé pour {name}.',
    '{name} reçoit un cadeau inattendu.',
    'Un inconnu prétend connaître le vrai nom de {name}.',
    '{name} est forcé·e de travailler avec son plus grand ennemi.',
    'Écris sur le souvenir le plus heureux de {name} et pourquoi il le hante.',
    '{name} trouve une porte qui ne devrait pas exister.',
    '{name} doit dire au revoir à quelque chose qu\'il/elle aime.',
    'Quelqu\'un du passé de {name} revient — et n\'est plus la même personne.',
    '{name} se voit offrir exactement ce qu\'il/elle a toujours voulu — à un prix terrible.',
  ],

  German: [
    '{name} muss sich jemandem aus ihrer Vergangenheit stellen.',
    'Schreib eine Szene, in der {name} ein lang gehütetes Geheimnis entdeckt.',
    '{name} wacht an einem fremden Ort auf ohne Erinnerung.',
    'Jemand stellt {name}s tiefste Überzeugung in Frage.',
    '{name} muss zwischen Loyalität und Moral wählen.',
    'Schreib über den Tag, an dem sich alles für {name} veränderte.',
    '{name} erhält ein unerwartetes Geschenk.',
    'Ein Fremder behauptet, {name}s wahren Namen zu kennen.',
    '{name} muss mit ihrem größten Feind zusammenarbeiten.',
    'Schreib über {name}s schönste Erinnerung und warum sie sie verfolgt.',
    '{name} findet eine Tür, die nicht existieren sollte.',
    '{name} muss sich von etwas verabschieden, das sie liebt.',
    'Jemand aus {name}s Vergangenheit kehrt zurück — völlig verändert.',
  ],

  Japanese: [
    '{name}は過去の誰かと向き合わなければならない。',
    '{name}が長年隠されてきた秘密を発見する場面を書こう。',
    '{name}は記憶のない見知らぬ場所で目を覚ます。',
    '誰かが{name}の最も深い信念に挑戦する。',
    '{name}は忠誠心と道徳のどちらかを選ばなければならない。',
    '{name}にとってすべてが変わった日について書こう。',
    '{name}は予期しない贈り物を受け取る。',
    '見知らぬ人が{name}の本当の名前を知っていると主張する。',
    '{name}は最大の敵と協力しなければならない。',
    '{name}の最も幸せな記憶と、なぜそれが心を悩ませるかを書こう。',
    '{name}は存在しないはずの扉を見つける。',
    '{name}はとうとう限界を超えた瞬間を書こう。',
    '{name}は過去の人物と再会する — その人はもう同じではない。',
    '{name}はずっと望んでいたものを差し出される — しかし代償は大きい。',
  ],

  Korean: [
    '{name}은/는 과거의 누군가와 맞서야 한다.',
    '{name}이/가 오래된 비밀을 발견하는 장면을 써보자.',
    '{name}은/는 기억 없이 낯선 곳에서 눈을 뜬다.',
    '누군가 {name}의 가장 깊은 신념에 도전한다.',
    '{name}은/는 충성심과 도덕 사이에서 선택해야 한다.',
    '{name}에게 모든 것이 바뀐 날에 대해 써보자.',
    '{name}은/는 예상치 못한 선물을 받는다.',
    '낯선 사람이 {name}의 진짜 이름을 안다고 주장한다.',
    '{name}은/는 최대의 적과 협력해야 한다.',
    '{name}의 가장 행복한 기억과 왜 그것이 마음을 떠나지 않는지 써보자.',
    '{name}은/는 존재해서는 안 되는 문을 발견한다.',
    '{name}이/가 드디어 한계에 달한 순간을 써보자.',
  ],

  Italian: [
    '{name} deve confrontarsi con qualcuno del suo passato.',
    'Scrivi una scena in cui {name} scopre un segreto custodito da tempo.',
    '{name} si sveglia in un posto sconosciuto senza ricordare come ci è arrivato/a.',
    'Qualcuno sfida la convinzione più profonda di {name}.',
    '{name} deve scegliere tra lealtà e moralità.',
    'Scrivi del giorno in cui tutto è cambiato per {name}.',
    '{name} riceve un dono inaspettato.',
    'Uno sconosciuto afferma di conoscere il vero nome di {name}.',
    '{name} è costretto/a a collaborare con il suo peggior nemico.',
    'Scrivi del ricordo più felice di {name} e perché lo tormenta.',
    '{name} trova una porta che non dovrebbe esistire.',
    '{name} deve dire addio a qualcosa che ama.',
  ],

  Portuguese: [
    '{name} precisa enfrentar alguém do seu passado.',
    'Escreva uma cena onde {name} descobre um segredo guardado há muito tempo.',
    '{name} acorda em um lugar desconhecido sem memória de como chegou lá.',
    'Alguém desafia a crença mais profunda de {name}.',
    '{name} precisa escolher entre lealdade e moral.',
    'Escreva sobre o dia em que tudo mudou para {name}.',
    '{name} recebe um presente que nunca esperou.',
    'Um estranho afirma conhecer o verdadeiro nome de {name}.',
    '{name} é forçado/a a trabalhar com seu maior inimigo.',
    'Escreva sobre a memória mais feliz de {name} e por que ela a assombra.',
    '{name} encontra uma porta que não deveria existir.',
    '{name} precisa se despedir de algo que ama.',
  ],

  // ── Add more languages below! Copy the format above. ──

};