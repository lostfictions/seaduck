import { Narrative, StoryEvent, choice } from "../main";

const randomPronouns = () =>
  choice([
    { ps: "he", po: "him", pp: "his" },
    { ps: "she", po: "her", pp: "her" },
    { ps: "they", po: "them", pp: "their" }
  ]);

const n = new Narrative({
  nouns: [
    {
      name: "kitchen",
      properties: {},
      tags: ["room"]
    },
    {
      name: "living room",
      properties: {},
      tags: ["room"]
    },
    {
      name: "study",
      properties: {},
      tags: ["room"]
    },
    {
      name: "Max",
      properties: {
        has_drink: false,
        ...randomPronouns()
      },
      tags: ["person"]
    },
    {
      name: "Rory",
      properties: {
        has_drink: false,
        ...randomPronouns()
      },
      tags: ["person"]
    },
    {
      name: "coffee",
      properties: {},
      tags: ["drink"]
    },
    {
      name: "tea",
      properties: {},
      tags: ["drink"]
    }
  ],
  initialize: function*() {
    // set up map
    this.reciprocal(
      "connects to",
      this.noun("kitchen"),
      this.noun("living room")
    );
    this.reciprocal("connects to", this.noun("kitchen"), this.noun("study"));

    // put people and objects in rooms
    this.relate("currently in", this.noun("Max"), this.noun("living room"));
    yield new StoryEvent("in", this.noun("Max"), this.noun("living room"));

    this.relate("currently in", this.noun("Rory"), this.noun("study"));
    yield new StoryEvent("in", this.noun("Rory"), this.noun("study"));

    this.relate("currently in", this.noun("coffee"), this.noun("kitchen"));
    yield new StoryEvent("in", this.noun("coffee"), this.noun("kitchen"));

    this.relate("currently in", this.noun("tea"), this.noun("kitchen"));
    yield new StoryEvent("in", this.noun("tea"), this.noun("kitchen"));
  },
  actions: [
    {
      name: "take",
      match: ["#person", "#drink"],
      when: function(a, b) {
        const aLocation = this.relatedByTag("currently in", a, "room");
        const bLocation = this.relatedByTag("currently in", b, "room");
        return aLocation == bLocation && !a.properties.has_drink;
      },
      action: function*(a, b) {
        yield new StoryEvent("take", a, b);
        // remove from all rooms
        this.unrelateByTag("currently in", b, "room");
        a.properties.has_drink = true;
      }
    },
    {
      name: "move",
      match: ["#person"],
      when: function(a) {
        return !(
          this.isRelated("currently in", a, this.noun("study")) &&
          a.properties.has_drink
        );
      },
      action: function*(a) {
        const current = this.relatedByTag("currently in", a, "room");
        const dests = this.allRelatedByTag("connects to", current, "room");
        const chosenDest = choice(dests);
        this.unrelate("currently in", a, current);
        this.relate("currently in", a, chosenDest);
        yield new StoryEvent("moveTo", a, chosenDest);
      }
    },
    {
      name: "talk",
      match: ["#person", "#person"],
      when: function(a, b) {
        const aLocation = this.relatedByTag("currently in", a, "room");
        const bLocation = this.relatedByTag("currently in", b, "room");
        return aLocation == bLocation;
      },
      action: function*(a, b) {
        yield new StoryEvent("chatsWith", a, b);
      }
    },
    {
      name: "work",
      match: ["#person"],
      when: function(a) {
        return (
          this.isRelated("currently in", a, this.noun("study")) &&
          a.properties.has_drink
        );
      },
      action: function*(a) {
        yield new StoryEvent("isWorking", a);
      }
    },
    {
      name: "play video games",
      match: ["#person"],
      when: function(a) {
        return this.isRelated("currently in", a, this.noun("living room"));
      },
      action: function*(a) {
        yield new StoryEvent("playGames", a);
      }
    }
  ],
  traceryDiscourse: {
    in: ["#nounA.capitalize# was in the #nounB#."],
    take: [
      "#nounA# took #nounB#.",
      "'Oh, hey, #nounB#!' said #nounA#, and picked it up."
    ],
    moveTo: [
      "After a while, #nounA# went into the #nounB#.",
      "#nounA# decided to go into the #nounB#."
    ],
    topic: [
      "the weather",
      "the garden",
      "the phase of the moon",
      "#nounA#'s family",
      "the books they've been reading"
    ],
    chatsWith: [
      "#nounA# and #nounB# chatted for a bit.",
      "#nounA# asked #nounB# how #nounB_pp# day was going.",
      "#nounB# told #nounA# about a dream #nounB_ps# had last night.",
      "#nounA# and #nounB# talked for a bit about #topic#."
    ],
    isWorking: [
      "#nounA# typed furiously on #nounA_pp# laptop.",
      "#nounA# was taking notes while reading a book from the library.",
      "#nounA# sighed as #nounA_ps# clicked 'Send' on another e-mail."
    ],
    videoGame: ["Destiny 2", "Splatoon 2", "Skyrim", "Zelda", "Bejeweled"],
    playGames: [
      "#nounA# sat down to play #videoGame# for a while.",
      "#nounA# decided to get a few minutes of #videoGame# in.",
      "#nounA# turned on the video game console. 'Ugh I love #videoGame# so much,' #nounA_ps# said."
    ],
    _end: ["The end."]
  }
});

for (let i = 0; i < 100; i++) {
  const storyEvents = n.stepAndRender();
  if (storyEvents.length > 0) {
    for (const ev of storyEvents) {
      console.log(ev);
    }
  } else {
    break;
  }
}
