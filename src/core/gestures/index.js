import { GESTURE_CONFIG } from '../../config/gestures.js';
import { createRecognizer as jump } from './jump.js';
import { createRecognizer as run } from './run.js';
import { createRecognizer as walk } from './walk.js';
import { createRecognizer as dance } from './dance.js';
import { createRecognizer as swim } from './swim.js';
import { createRecognizer as fly } from './fly.js';
import { createRecognizer as climb } from './climb.js';
import { createRecognizer as catchGesture } from './catch.js';
import { createRecognizer as drink } from './drink.js';
import { createRecognizer as eat } from './eat.js';
import { createRecognizer as cut } from './cut.js';
import { createRecognizer as wash } from './wash.js';
import { createRecognizer as stop } from './stop.js';

export const RECOGNIZER_FACTORIES = Object.freeze({ jump, run, walk, dance, swim, fly, climb, catch: catchGesture, drink, eat, cut, wash, stop });

export function getRecognizer(verb, config = GESTURE_CONFIG[verb]) {
  const factory = RECOGNIZER_FACTORIES[verb];
  if (!factory) throw new RangeError(`Unknown gesture: ${verb}`);
  if (!config) throw new TypeError(`Missing configuration for gesture: ${verb}`);
  return factory(config);
}
