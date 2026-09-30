// Charactry — Interaction Simulator Data
// Place next to index.html to extend scenario pool.
// All arrays are merged with built-in data at runtime.

window.IXN_DATA = {

  // ── Scenario contexts ─────────────────────────────────────────
  scenarios: [
    "arguing over a failed plan",
    "training together at dawn",
    "accidentally revealing a secret",
    "teasing each other relentlessly",
    "fighting side by side",
    "stuck waiting in the rain",
    "sharing the last of their food",
    "disagreeing over morals",
    "competing for the same goal",
    "nursing each other's wounds after a battle",
    "discovering they have a common enemy",
    "meeting again after a long separation",
    "caught in a lie",
    "both reaching for the same object",
    "forced to share a small space",
    "one saving the other from danger",
    "drunk or delirious and unfiltered",
    "arguing about who leads",
    "one teaching the other a skill",
    "being cornered with no escape",
    "stargazing in tense silence",
    "arguing over something completely trivial",
    "one apologizing for something old",
    "spying on someone together",
    "finding an old memory of each other",
    "one confessing something unexpected",
    "one trying to make the other laugh",
    "realizing they misjudged each other",
    "preparing for something they may not survive",
    "debating whose philosophy is right",
  ],

  // ── Opening beats ─────────────────────────────────────────────
  openers: [
    "{A} breaks the silence first.",
    "{B} shows up uninvited.",
    "{A} makes a pointed remark.",
    "{B} refuses to look at {A}.",
    "Neither speaks for a long moment.",
    "{A} laughs — though nothing is funny.",
    "{B} crosses their arms and waits.",
    "{A} does something {B} doesn't expect.",
    "{B} says exactly the wrong thing.",
    "The tension between them is obvious to everyone else.",
    "{A} pretends this doesn't matter.",
    "{B} brings up something {A} hoped was forgotten.",
  ],

  // ── Beat middles (use {A}, {B}, {trait_a}, {trait_b}) ─────────
  beats: [
    "{A}'s {trait_a} clashes hard with {B}'s {trait_b}.",
    "{B} pushes further than {A} expected.",
    "{A} almost says what they really mean.",
    "Something shifts — neither acknowledges it.",
    "{B} calls {A} out on their contradiction.",
    "{A} goes quiet. That's worse than shouting.",
    "{B} is trying. {A} isn't making it easy.",
    "For a second, {A} and {B} are completely in sync.",
    "{A} does the last thing {B} would have predicted.",
    "{B} doesn't fight back. That surprises {A}.",
    "{A} and {B} both know who's right. Neither says it.",
    "{B} watches {A} more carefully than usual.",
  ],

  // ── Tension types ─────────────────────────────────────────────
  tensions: [
    "unresolved history",
    "a power imbalance neither admits to",
    "something left unsaid for too long",
    "wanting the same thing for different reasons",
    "one protecting the other without admitting it",
    "mutual respect buried under rivalry",
    "guilt that only one of them carries",
    "a secret one of them is keeping",
    "grief neither knows how to talk about",
    "a line that keeps getting closer to being crossed",
    "old trust that isn't quite rebuilt yet",
    "competitive energy that bleeds into everything",
  ],

  // ── Outcomes ──────────────────────────────────────────────────
  outcomes: [
    "Nothing is resolved. But something is different now.",
    "They part without another word — and both feel it.",
    "{A} walks away first. {B} watches them go.",
    "It ends in unexpected laughter.",
    "They reach a truce that won't last.",
    "Something cracks open between them — in a good way.",
    "The argument continues somewhere else, in silence.",
    "{B} says one thing. {A} will think about it for days.",
    "A small moment of honesty neither planned for.",
    "They don't fix anything. They don't need to, yet.",
    "What was hidden is still hidden — but both know it's there.",
    "It ends with something that might, eventually, become trust.",
  ],

  // ── Relationship-flavored closers ──────────────────────────────
  rel_flavors: {
    partner:     "{A} and {B} both know this is part of what makes them work.",
    spouse:      "Even in conflict, there's something settled between them.",
    crush:       "{name} leaves before {other} can see their expression.",
    ex:          "Old feelings don't stay buried. They never do.",
    friend:      "It's the kind of fight only close friends can have.",
    'best friend': "They'll be fine. They always are. That's the terrifying part.",
    rival:       "Neither will admit the other made a good point.",
    enemy:       "One day this won't end with words.",
    sibling:     "It's petty and personal and completely normal for them.",
    mentor:      "The student is catching up. The teacher isn't sure how to feel.",
    student:     "The lesson today wasn't the one on the schedule.",
    ally:        "Different sides of the same goal — and they both know it.",
    default:     "Whatever this is between them, it's not finished.",
  },

  // ── Trait reaction pairs (trait → reaction phrase) ─────────────
  trait_reactions: {
    stubborn:    "refuses to move an inch",
    impulsive:   "acts before thinking it through",
    loyal:       "won't leave, even when it would be easier",
    cold:        "keeps their face unreadable",
    sarcastic:   "has a comeback for everything",
    brave:       "steps forward when anyone else would step back",
    reckless:    "throws caution somewhere {other} can't find it",
    quiet:       "says less than they mean",
    protective:  "puts themselves between {other} and the problem",
    ambitious:   "turns everything into an opportunity",
    gentle:      "is careful in ways that surprise {other}",
    ruthless:    "makes the call no one else wanted to make",
    curious:     "asks the question no one thought to ask",
    proud:       "won't ask for help, even now",
    charismatic: "manages to make even this charming somehow",
    volatile:    "feels everything too loudly",
    detached:    "watches it all from just outside the moment",
    clever:      "already knows where this is going",
  },

  // ── Dialogue exchanges ─────────────────────────────────────────
  // Each entry: array of {speaker:'A'|'B', line:string}
  // {A} and {B} are replaced with character names at runtime.
  // Add your own exchanges below — they all go into the same pool.
  dialogue: [

    // Cold / clipped
    [{speaker:'A',line:"You're doing it again."},{speaker:'B',line:"Doing what?"},{speaker:'A',line:"Pretending you don't know exactly what you're doing."}],
    [{speaker:'B',line:"Are you done?"},{speaker:'A',line:"I haven't started."},{speaker:'B',line:"That's what I was afraid of."}],
    [{speaker:'A',line:"Say it. Whatever it is you're not saying."},{speaker:'B',line:"...No."},{speaker:'A',line:"Then don't look at me like that."}],
    [{speaker:'B',line:"You always do this."},{speaker:'A',line:"Do what, exactly?"},{speaker:'B',line:"Make everything harder than it needs to be."}],

    // Teasing / banter
    [{speaker:'A',line:"You're insufferable, you know that?"},{speaker:'B',line:"You've mentioned it. Several times."},{speaker:'A',line:"I'll keep mentioning it."}],
    [{speaker:'B',line:"That was your plan?"},{speaker:'A',line:"It worked, didn't it?"},{speaker:'B',line:"Barely. Barely worked."}],
    [{speaker:'A',line:"I could have handled that myself."},{speaker:'B',line:"Clearly."},{speaker:'A',line:"Was that sarcasm?"},{speaker:'B',line:"Little bit."}],
    [{speaker:'B',line:"Stop smiling."},{speaker:'A',line:"I'm not smiling."},{speaker:'B',line:"You're absolutely smiling."}],

    // Tension / push-pull
    [{speaker:'A',line:"Why does it matter to you?"},{speaker:'B',line:"It doesn't."},{speaker:'A',line:"Then why are you still here?"}],
    [{speaker:'B',line:"I don't need your help."},{speaker:'A',line:"I know."},{speaker:'B',line:"Then why—"},{speaker:'A',line:"I'm not here for you. I'm here anyway."}],
    [{speaker:'A',line:"You're not as difficult to read as you think."},{speaker:'B',line:"Good. Then you already know my answer."},{speaker:'A',line:"...Unfortunately."}],
    [{speaker:'B',line:"This isn't about me, is it."},{speaker:'A',line:"Don't flatter yourself."},{speaker:'B',line:"That wasn't flattery."}],

    // Raw / honest slip
    [{speaker:'A',line:"I didn't mean—"},{speaker:'B',line:"You did."},{speaker:'A',line:"...Yeah. I did. I'm sorry."}],
    [{speaker:'B',line:"Do you actually trust me?"},{speaker:'A',line:"I'm here, aren't I?"},{speaker:'B',line:"That's not what I asked."}],
    [{speaker:'A',line:"You scare me sometimes."},{speaker:'B',line:"Good."},{speaker:'A',line:"That wasn't a compliment."},{speaker:'B',line:"I know."}],
    [{speaker:'B',line:"Why do you keep doing this?"},{speaker:'A',line:"Because someone has to."},{speaker:'B',line:"It doesn't have to be you."},{speaker:'A',line:"No. But it is."}],

    // Deflection / avoidance
    [{speaker:'A',line:"We should talk about what happened."},{speaker:'B',line:"We really shouldn't."},{speaker:'A',line:"{B}."},{speaker:'B',line:"Drop it."}],
    [{speaker:'B',line:"Forget it."},{speaker:'A',line:"I'm not going to forget it."},{speaker:'B',line:"Then we have a problem."}],
    [{speaker:'A',line:"Are you actually okay?"},{speaker:'B',line:"I'm fine."},{speaker:'A',line:"That was fast."},{speaker:'B',line:"I said I'm fine."}],

    // Rivalry / respect
    [{speaker:'B',line:"You're better at this than I expected."},{speaker:'A',line:"Was that a compliment?"},{speaker:'B',line:"Don't push it."}],
    [{speaker:'A',line:"Admit it. That was impressive."},{speaker:'B',line:"It was adequate."},{speaker:'A',line:"Adequate. Right."}],
    [{speaker:'B',line:"I still think you're wrong."},{speaker:'A',line:"You would."},{speaker:'B',line:"But your logic wasn't terrible."},{speaker:'A',line:"Hold on, let me write that down."}],

    // Quiet / weighted
    [{speaker:'A',line:"I missed you."},{speaker:'B',line:"...Don't say things like that."},{speaker:'A',line:"Why not?"},{speaker:'B',line:"Because I don't know what to do with it."}],
    [{speaker:'B',line:"You came back."},{speaker:'A',line:"I said I would."},{speaker:'B',line:"People say a lot of things."}],
    [{speaker:'A',line:"What do you want from me?"},{speaker:'B',line:"Nothing. Everything."},{speaker:'A',line:"That's not an answer."},{speaker:'B',line:"No. It's not."}],
    [{speaker:'B',line:"Stay."},{speaker:'A',line:"...Okay."}],

    // Conflict / fight
    [{speaker:'A',line:"You had no right."},{speaker:'B',line:"Maybe not."},{speaker:'A',line:"Then why?"},{speaker:'B',line:"Because you weren't going to do it yourself."}],
    [{speaker:'B',line:"You're making a mistake."},{speaker:'A',line:"Wouldn't be my first."},{speaker:'B',line:"This one's different."},{speaker:'A',line:"They all feel different at the time."}],
    [{speaker:'A',line:"That's not fair."},{speaker:'B',line:"No. It isn't."},{speaker:'A',line:"Then why are you—"},{speaker:'B',line:"Because fair stopped mattering a long time ago."}],

    // Dry / understated
    [{speaker:'A',line:"You knew this would happen."},{speaker:'B',line:"I had a theory."},{speaker:'A',line:"And you didn't say anything?"},{speaker:'B',line:"You wouldn't have listened."}],
    [{speaker:'B',line:"That could have gone worse."},{speaker:'A',line:"It went pretty badly."},{speaker:'B',line:"Hence: could have gone worse."}],
    [{speaker:'A',line:"I don't need you to agree with me."},{speaker:'B',line:"Good. I don't."},{speaker:'A',line:"Good."},{speaker:'B',line:"Good."}],

    // Soft / tentative
    [{speaker:'B',line:"Can I ask you something?"},{speaker:'A',line:"You're going to regardless."},{speaker:'B',line:"...Do you ever regret it?"},{speaker:'A',line:"I try not to answer questions like that."}],
    [{speaker:'A',line:"You've been quiet."},{speaker:'B',line:"I'm always quiet."},{speaker:'A',line:"Not like this."}],
    [{speaker:'B',line:"I didn't think you'd still be here."},{speaker:'A',line:"Where else would I be?"},{speaker:'B',line:"That's... not nothing."}],

    // Frustration
    [{speaker:'A',line:"Why won't you just let me help?"},{speaker:'B',line:"Because then I'd owe you something."},{speaker:'A',line:"That's not how this works."},{speaker:'B',line:"It is for me."}],
    [{speaker:'B',line:"You're not listening."},{speaker:'A',line:"I'm listening. I just don't agree."},{speaker:'B',line:"Then what's the point?"}],
    [{speaker:'A',line:"Just once — just once — could you not do that?"},{speaker:'B',line:"Do what?"},{speaker:'A',line:"You know exactly what."}],

    // Wry / dark humor
    [{speaker:'B',line:"On a scale of one to catastrophic—"},{speaker:'A',line:"Don't finish that."},{speaker:'B',line:"I was going to say moderate."},{speaker:'A',line:"You were not."}],
    [{speaker:'A',line:"We've had worse plans."},{speaker:'B',line:"Name one."},{speaker:'A',line:"...I'm sure there were some."}],
    [{speaker:'B',line:"If this kills us, I want it on record that this was your idea."},{speaker:'A',line:"Noted."},{speaker:'B',line:"I'm serious."},{speaker:'A',line:"I know. So am I."}],

    // Loaded history
    [{speaker:'A',line:"You said that last time too."},{speaker:'B',line:"Last time was different."},{speaker:'A',line:"You said that last time too."}],
    [{speaker:'B',line:"We've been here before."},{speaker:'A',line:"Not exactly here."},{speaker:'B',line:"Close enough that I know how it ends."}],
    [{speaker:'A',line:"I thought we were past this."},{speaker:'B',line:"We were."},{speaker:'A',line:"Then what happened?"},{speaker:'B',line:"You did."}],

    // Confessional
    [{speaker:'B',line:"I was scared."},{speaker:'A',line:"...Me too."},{speaker:'B',line:"You didn't show it."},{speaker:'A',line:"Neither did you."}],
    [{speaker:'A',line:"I don't know how to do this."},{speaker:'B',line:"Neither do I."},{speaker:'A',line:"That's not helpful."},{speaker:'B',line:"No. But at least we're both lost."}],
    [{speaker:'B',line:"Sometimes I think you actually care."},{speaker:'A',line:"Sometimes I do."},{speaker:'B',line:"...Oh."}],

    // Competitive
    [{speaker:'A',line:"I would have done it faster."},{speaker:'B',line:"You would have done it wrong."},{speaker:'A',line:"Faster and wrong beats slow and smug."},{speaker:'B',line:"Does it? Does it really?"}],
    [{speaker:'B',line:"Fine. You were right."},{speaker:'A',line:"I'm sorry, could you say that again?"},{speaker:'B',line:"Absolutely not."}],
    [{speaker:'A',line:"You're improving."},{speaker:'B',line:"Don't patronise me."},{speaker:'A',line:"I meant it."},{speaker:'B',line:"...I know. That's worse."}],

    // Protective / tender
    [{speaker:'B',line:"You're bleeding."},{speaker:'A',line:"I'm aware."},{speaker:'B',line:"Let me—"},{speaker:'A',line:"I'm fine."},{speaker:'B',line:"You're not. Stop moving."}],
    [{speaker:'A',line:"You didn't have to do that."},{speaker:'B',line:"No."},{speaker:'A',line:"Then why—"},{speaker:'B',line:"Don't make it weird."}],
    [{speaker:'B',line:"Get some sleep."},{speaker:'A',line:"I'm not tired."},{speaker:'B',line:"{B}."},{speaker:'A',line:"...Fine."}],

    // Unresolved endings
    [{speaker:'A',line:"This isn't over."},{speaker:'B',line:"I know."},{speaker:'A',line:"So do you have anything to say?"},{speaker:'B',line:"Not yet."}],
    [{speaker:'B',line:"What do we do now?"},{speaker:'A',line:"I don't know."},{speaker:'B',line:"That's a first."},{speaker:'A',line:"Don't get used to it."}],
    [{speaker:'A',line:"Are we okay?"},{speaker:'B',line:"...Ask me again tomorrow."},{speaker:'A',line:"That's not an answer."},{speaker:'B',line:"No. But it's honest."}],

    // ── Add your own below this line ──────────────────────────────
    // [{speaker:'A',line:"..."},{speaker:'B',line:"..."},{speaker:'A',line:"..."}],

  ],
};