const test = require('node:test');
const assert = require('node:assert/strict');

const { createDomElements } = require('../ui/dom-elements');

test('createDomElements keeps known renderer element keys', () => {
  const queriedSelectors = [];
  const queriedAllSelectors = [];
  const doc = {
    querySelector(selector) {
      queriedSelectors.push(selector);
      return { selector };
    },
    querySelectorAll(selector) {
      queriedAllSelectors.push(selector);
      return [{ selector }];
    }
  };

  const elements = createDomElements(doc);

  assert.equal(elements.windowTitlebar.selector, '#windowTitlebar');
  assert.equal(elements.draftView.selector, '#draftView');
  assert.equal(elements.stateJson.selector, '#stateJson');
  assert.deepEqual(elements.tabButtons, [{ selector: '.tab-button' }]);
  assert.deepEqual(elements.statsSubtabButtons, [{ selector: '.stats-subtab' }]);
  assert.ok(queriedSelectors.includes('#championPoolPickerGrid'));
  assert.deepEqual(queriedAllSelectors, ['.tab-button', '.stats-subtab']);
});
