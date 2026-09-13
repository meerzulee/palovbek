# Plov menu and cooking protocol

These are simplified, researched adaptations for a toy kitchen. They are not timing, water, or food-safety instructions for a real stove. Quantities establish a base serving; simulated neural output can vary gram/ml/teaspoon portions by up to 20%. Regional cooks use different methods, and no single order describes every Uzbek plov.

| Menu | Distinct ingredients and sequence | Reference |
|---|---|---|
| Choyxona plov | Onion, lamb, carrot matchsticks, cumin and garlic; zirvak before rice | [Uzbek plov traditions](https://www.advantour.com/uzbekistan/uzbek-food/plov.htm), [lamb plov method](https://www.gastronom.ru/recipe/amp/26556) |
| Behili palov | Quince pieces simmer in the zirvak before rice | [Quince plov](https://www.tasteatlas.com/behili-palov) |
| To‘y oshi | Chickpeas and raisins in the zirvak; prepared quail eggs and qazi added after steaming | [Regional and wedding plov](https://www.tlca.asia/articles/2) |
| Bedana palov | Prepared stuffed quails join the zirvak for a longer simmer, before the rice | [Bedana recipe by emir](https://ovkuse.ru/recipes/4105748) |

Recipe catalog and ingredient quantities: `shared/recipes.json`. The Python recipe controller and browser controller consume this same catalog. Food meshes in `src/recipeFood.ts` show quince, chickpeas, raisins, egg halves, qazi slices and roast quails on the prep shelf and in the qazan when actually added.

Preparation assumptions: onions and lamb are cut before the episode; rice is pre-rinsed, quince cored and cut, chickpeas soaked, quails cleaned and stuffed, eggs boiled and peeled, and qazi cooked. Palov visibly chops carrots, transports ingredients, pours, stirs before rice, tends heat, and watches the steaming stage. We do not imply that the fly performed preparation which the scene does not simulate.

The controller requires hot oil before onion, browned lamb before carrot, three carrot chops, zirvak before rice, low heat under the lid, cooked rice before rest/serve, and an undamaged dish. The log records the actual path taken. An incorrect ingredient order or missing portion blocks the controller instead of fabricating success.

All four variants are checked at 80%, 100%, and 120% continuous ingredient portions. These tests exercise the feedback rules, not a prerecorded completion time. A separate full-graph browser episode tests the neural readout, rendering, download recovery, and complete wedding recipe together.
