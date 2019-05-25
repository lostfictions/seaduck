import hash from "object-hash";
import tracery from "tracery-grammar";

function mk<T>(t: T[]): string {
  return t.join("$");
}

function filterTagMatch(matchStr: string, item: Noun) {
  if (matchStr.charAt(0) == "#") {
    const tagStr = matchStr.substring(1);
    if (item.tags.includes(tagStr)) {
      return true;
    }
  } else {
    if (item.name == matchStr) {
      return true;
    }
  }
  return false;
}

interface Noun {
  name: string;
  properties: {
    [prop: string]: any;
  };
  tags: string[];
}

// type Action = Action1 | Action2;
interface Action {
  name?: string;
  match: string[];
  when(this: Narrative, a: Noun, b: Noun): boolean;
  action(this: Narrative, a: Noun, b: Noun): IterableIterator<StoryEvent>;
}

interface Action1 {
  name?: string;
  match: [string];
  when(this: Narrative, a: Noun): boolean;
  action(this: Narrative, a: Noun): IterableIterator<StoryEvent>;
}

interface Action2 {
  name?: string;
  match: [string, string];
  when(this: Narrative, a: Noun, b: Noun): boolean;
  action(this: Narrative, a: Noun, b: Noun): IterableIterator<StoryEvent>;
}

const isAction2 = (a: Action): a is Action2 => a.match.length === 2;

interface NarrativeDefinition {
  nouns: Noun[];
  actions: Action[];
  traceryDiscourse: {
    [tag: string]: string[];
  };
  initialize?(this: Narrative): IterableIterator<StoryEvent>;
}

export class Narrative {
  narrative: NarrativeDefinition;
  stepCount = 0;
  relations = new Map<string, boolean>();
  eventHistory: StoryEvent[] = [];
  stateHistory: string[] = [];

  constructor(narrative: NarrativeDefinition) {
    this.narrative = narrative;
  }

  choice<T>(t: T[]): T {
    // convenience function for selecting among alternatives in a list
    return t[Math.floor(Math.random() * t.length)];
  }

  noun(name: string): Noun {
    // get the noun object in the narrative with the corresponding name
    for (const noun of this.narrative.nouns) {
      if (noun.name === name) {
        return noun;
      }
    }
    throw new Error(`Unknown noun "${name}"!`);
  }

  getNounsByTag(tag: string): Noun[] {
    // get all nouns in the narrative with this tag
    const matches = [];
    for (const noun of this.narrative.nouns) {
      if (noun.tags.includes(tag)) {
        matches.push(noun);
      }
    }
    return matches;
  }

  getNounsByProperty(prop: string, val: unknown): Noun[] {
    // get all nouns with this property
    const matches = [];
    for (const noun of this.narrative.nouns) {
      if (noun.properties[prop] === val) {
        matches.push(noun);
      }
    }
    return matches;
  }

  relate(rel: string, a: Noun, b: Noun) {
    // relate a to b with relation rel
    this.relations.set(mk([rel, a.name, b.name]), true);
  }

  unrelate(rel: string, a: Noun, b: Noun) {
    // remove relation rel between a and b
    this.relations.delete(mk([rel, a.name, b.name]));
  }

  unrelateByTag(rel: string, a: Noun, bTag: string) {
    // remove relation rel between a and nouns tagged with bTag
    for (const noun of this.allRelatedByTag(rel, a, bTag)) {
      this.unrelate(rel, a, noun);
    }
  }

  reciprocal(rel: string, a: Noun, b: Noun) {
    // relate a to b reciprocally with relation rel
    this.relations.set(mk([rel, a.name, b.name]), true);
    this.relations.set(mk([rel, b.name, a.name]), true);
  }

  unreciprocal(rel: string, a: Noun, b: Noun) {
    // remove reciprocal relation rel between a and b
    this.relations.delete(mk([rel, a.name, b.name]));
    this.relations.delete(mk([rel, b.name, a.name]));
  }

  unreciprocalByTag(rel: string, a: Noun, bTag: string) {
    // remove reciprocal relation rel between a and nouns tagged with bTag
    for (const noun of this.allRelatedByTag(rel, a, bTag)) {
      this.unrelate(rel, a, noun);
      this.unrelate(rel, noun, a);
    }
  }

  isRelated(rel: string, a: Noun, b: Noun) {
    // return true if a and b are related with rel
    return this.relations.get(mk([rel, a.name, b.name])) || false;
  }

  allRelatedByTag(rel: string, a: Noun, bTag: string) {
    // returns all nouns related to a by rel with tag bTag
    const matches = [];
    const byTag = this.getNounsByTag(bTag);
    for (const b of byTag) {
      if (this.isRelated(rel, a, b)) {
        matches.push(b);
      }
    }
    return matches;
  }

  relatedByTag(rel: string, a: Noun, bTag: string): Noun {
    // returns only the first noun related to a by rel with tag bTag
    return this.allRelatedByTag(rel, a, bTag)[0];
  }

  init() {
    // call the initialize function and add events to history
    const events = [];
    const boundInit = this.narrative.initialize!.bind(this);
    for (const sEvent of boundInit()) {
      this.eventHistory.push(sEvent);
      events.push(sEvent);
    }
    return events;
  }

  step() {
    // step through the simulation
    // do nothing if story is over
    if (
      this.eventHistory.length > 0 &&
      this.eventHistory[this.eventHistory.length - 1].ending()
    ) {
      return [];
    }
    // initialize on stepCount 0, if provided
    if (this.stepCount == 0 && this.narrative.hasOwnProperty("initialize")) {
      this.stepCount++;
      return this.init();
    }

    const events: StoryEvent[] = [];
    // for matches with two parameters
    for (const action of this.narrative.actions) {
      if (isAction2(action)) {
        const matchingA = this.narrative.nouns.filter(item =>
          filterTagMatch(action.match[0], item)
        );
        const matchingB = this.narrative.nouns.filter(item =>
          filterTagMatch(action.match[1], item)
        );

        const boundWhen = action.when.bind(this);
        const boundAction = action.action.bind(this);
        for (const objA of matchingA) {
          for (const objB of matchingB) {
            if (objA == objB) {
              continue;
            }
            if (boundWhen(objA, objB)) {
              for (const sEvent of boundAction(objA, objB)) {
                this.eventHistory.push(sEvent);
                events.push(sEvent);
              }
            }
          }
        }
      }
      // for matches with one parameter
      else if (action.match.length == 1) {
        const matching = this.narrative.nouns.filter(item =>
          filterTagMatch(action.match[0], item)
        );

        // FIXME
        const boundWhen = action.when.bind(this) as any;
        const boundAction = action.action.bind(this) as any;
        for (const obj of matching) {
          if (boundWhen(obj)) {
            for (const sEvent of boundAction(obj)) {
              this.eventHistory.push(sEvent);
              events.push(sEvent);
            }
          }
        }
      }
    }

    // hash the current state and store
    this.stateHistory.push(hash(this.narrative.nouns) + hash(this.relations));

    this.stepCount++;

    // if the last two states are identical, or no events generated, the end
    const shLen = this.stateHistory.length;

    if (
      (shLen >= 2 &&
        this.stateHistory[shLen - 1] == this.stateHistory[shLen - 2]) ||
      events.length == 0
    ) {
      // _end is a special sentinel value to signal the end of the narration
      this.eventHistory.push(new StoryEvent("_end"));
      events.push(new StoryEvent("_end"));
    }

    return events;
  }
  renderEvent(ev: StoryEvent): string {
    // renders an event using the associated tracery rule
    const discourseCopy = JSON.parse(
      JSON.stringify(this.narrative.traceryDiscourse)
    );
    if (ev.a) {
      discourseCopy["nounA"] = ev.a.name;
      // copy properties as nounA_<propertyname>
      for (const k in ev.a.properties) {
        if (ev.a.properties.hasOwnProperty(k)) {
          discourseCopy["nounA_" + k] = ev.a.properties[k];
        }
      }
    }
    if (ev.b) {
      discourseCopy["nounB"] = ev.b.name;
      for (const k in ev.b.properties) {
        if (ev.b.properties.hasOwnProperty(k)) {
          discourseCopy["nounB_" + k] = ev.b.properties[k];
        }
      }
    }
    const grammar = tracery.createGrammar(discourseCopy);
    grammar.addModifiers(tracery.baseEngModifiers);
    return grammar.flatten("#" + ev.verb + "#");
  }
  stepAndRender() {
    // combines step() and renderEvent()
    const events = this.step();
    const rendered = [];
    for (const ev of events) {
      rendered.push(this.renderEvent(ev));
    }
    return rendered;
  }
}

export class StoryEvent {
  verb: string;
  a?: Noun;
  b?: Noun;
  arity = 0;

  constructor(verb: string, a?: Noun, b?: Noun) {
    this.verb = verb;
    if (a !== undefined) {
      this.a = a;
      this.arity++;
    }
    if (b !== undefined) {
      this.b = b;
      this.arity++;
    }
  }
  dump() {
    switch (this.arity) {
      case 0:
        return [this.verb];
      case 1:
        return [this.a!.name, this.verb];
      case 2:
        return [this.a!.name, this.verb, this.b!.name];
      default:
        throw new Error("Invalid arity!");
    }
  }

  ending(): boolean {
    return this.verb == "_end";
  }
}
