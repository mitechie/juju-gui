/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2012-2013 Canonical Ltd.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License version 3, as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranties of MERCHANTABILITY,
SATISFACTORY QUALITY, or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';


describe('search view', function() {
  var apiURL,
      container,
      view,
      Y;

  before(function(done) {
    Y = YUI(GlobalConfig).use(
        'json',
        'juju-charm-store',
        'juju-tests-utils',
        'juju-models',
        'node',
        'node-event-simulate',
        'subapp-browser-searchview',
        function(Y) {
          // Need the handlebars helper for the charm-token to render.
          Y.Handlebars.registerHelper(
              'charmFilePath',
              function(charmID, file) {
                return '/path/to/charm/' + file;
              });
          done();
        });
  });

  after(function(done) {
    Y.Handlebars.helpers.charmFilePath = undefined;
    done();
  });

  beforeEach(function() {
    // Mock out a dummy location for the Store used in view instances.
    window.juju_config = {charmworldURL: 'http://localhost'};
    container = Y.namespace('juju-tests.utils').makeContainer('container');
    view = new Y.juju.browser.views.BrowserSearchView({
      filters: {text: 'foo'}
    });
    //
    // Create monkeypatched store to verify right method is called.
    apiURL = '';
    var fakeStore = new Y.juju.Charmworld2({});
    var sampleData = {
      result: [{
        charm: {
          id: 'foo/bar-2',
          name: 'bar',
          description: 'some charm named bar',
          files: []
        }
      }]
    };
    fakeStore.set('datasource', {
      sendRequest: function(params) {
        // Stubbing the server callback value
        apiURL = params.request;
        params.callback.success({
          response: {
            results: [{
              responseText: Y.JSON.stringify(sampleData)
            }]
          }
        });
      }
    });
    view.set('store', fakeStore);
    view.set('renderTo', container);
  });

  afterEach(function() {
    delete window.juju_config;
    view.destroy();
    container.remove(true);
  });

  it('exists', function() {
    assert.isObject(view);
  });

  it('renders correctly', function() {
    view.render();
    var container = view.get('container');
    assert.equal('charms?text=foo', apiURL);
    assert.equal(1, container.all('.yui3-charmtoken').size());
    var charmText = container.one('.yui3-charmtoken').one('.title').get('text');
    assert.equal(charmText.replace(/\s+/g, ''), 'bar');
  });

  it('shows and hides an indicator', function(done) {
    var hit = 0;
    view.render();
    view.showIndicator = function() {
      hit += 1;
    };
    view.hideIndicator = function() {
      hit += 1;
      hit.should.equal(2);
      done();
    };
    view.render();
  });

  it('handles empty text for search', function() {
    view.set('filters', {text: ''});
    view.render();
    assert.equal('charms?text=', apiURL);
  });

  it('clicking a charm navigates for fullscreen', function(done) {
    view.render();
    view.on('viewNavigate', function(ev) {
      ev.halt();
      assert(ev.change.charmID === 'foo/bar-2');
      done();
    });

    container.one('.charm-token').simulate('click');
  });

  it('clicking a charm navigates for sidebar', function(done) {
    view.render();
    view.on('viewNavigate', function(ev) {
      ev.halt();
      assert(ev.change.charmID === 'foo/bar-2');
      done();
    });

    container.one('.charm-token').simulate('click');
  });

  it('tells listeners the cache has updated', function() {
    view.on(view.EV_CACHE_UPDATED, function(ev) {
      assert.isObject(ev.cache);
    });
    view.render();
  });

  it('uses passed in cache data if available', function() {
    var search_called = false,
        results = new Y.juju.models.BrowserCharmList();

    view.get('store').search = function() {
      search_called = true;
      return results;
    };
    view.render(results);
    assert.isFalse(search_called);

    view.render();
    assert.isTrue(search_called);
  });
});
