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


/**
 * The widget used across Browser view to manage the search box and the
 * controls for selecting which view you're in.
 *
 * @module widgets
 * @submodule browser
 *
 */
YUI.add('browser-search-widget', function(Y) {
  var ns = Y.namespace('juju.widgets.browser'),
      templates = Y.namespace('juju.views').Templates;


  /**
   * Search widget present in the Charm browser across both fullscreen and
   * sidebar views.
   *
   * @class Search
   * @extends {Y.Widget}
   * @event EV_CLEAR_SEARCH the widget requests all search reset.
   * @event EV_SEARCH_CHANGED the widgets notifies that the search input has
    changed.
   * @event EV_SEARCH_GOHOME Signal that the user clicked the home button.
   *
   */
  ns.Search = Y.Base.create('search-widget', Y.Widget, [
    Y.Event.EventTracker
  ], {
    EVT_CLEAR_SEARCH: 'clear_search',
    EVT_SEARCH_CHANGED: 'search_changed',
    EVT_SEARCH_GOHOME: 'go_home',

    TEMPLATE: templates['browser-search'],

    /**
     * Fetch, from the store, suggested options for the search autocomplete
     * widget.
     *
     * @method _fetchSuggestions
     * @param {String} query the search query terms.
     * @param {Function} callback the callback to the AC widget.
     *
     */
    _fetchSuggestions: function(query, callback) {
      var filters = this.get('filters');
      filters.text = query;
      (this.get('autocompleteSource'))(
          filters, {
            'success': callback,
            'failure': function() {
              // Autocomplete should not throw errors at the user or break the
              // application. Just silently fail to find results.
            }
          },
          this
      );
    },

    /**
     * Halt page reload from form submit and let the app know we have a new
     * search.
     *
     * @method _handleSubmit
     * @param {Event} ev the submit event.
     */
    _handleSubmit: function(ev) {
      ev.halt();
      var form = this.get('boundingBox').one('form'),
          value = form.one('input').get('value');

      this.fire(this.EVT_SEARCH_CHANGED, {
        newVal: value
      });
    },

    /**
     * When home is selected the event needs to be fired up to listeners.
     *
     * @method _onHome
     * @param {Event} ev The click event for the home button.
     *
     */
    _onHome: function(ev) {
      var form = this.get('boundingBox').one('form');
      form.one('input').set('value', '');
      ev.halt();
      this.fire(this.EVT_SEARCH_GOHOME);
    },

    /**
     * Set the form to active so that we can change the search appearance.
     *
     * @method _setActive
     * @private
     *
     */
    _setActive: function() {
      var form = this.get('boundingBox').one('form').addClass('active');
    },

    /**
     * Format the html that will be used in the AC widget results.
     *
     * Results need to be processed as charm tokens to get them to render
     * correctly with the right visual logic for reviewed/icons/etc.
     *
     * @method _suggestFormatter
     * @param {String} query the searched for query term.
     * @param {Array} results the list of objects from the AC processing of
     * the api results. Note: this is not the api json, but objects from the
     * AC processing.
     *
     */
    _suggestFormatter: function(query, results) {
      var dataprocessor = this.get('autocompleteDataFormatter');
      var charmlist = dataprocessor(Y.Array.map(results, function(res) {
        return res.raw;
      }));
      return charmlist.map(function(charm) {
        var container = Y.Node.create('<div class="yui3-charmtoken"/>');
        var tokenAttrs = Y.merge(charm.getAttrs(), {
          size: 'tiny'
        });
        var token = new ns.CharmToken(tokenAttrs);
        return container.append(token.TEMPLATE(token.getAttrs()));
      });
    },

    /**
     * Setup an autocomplete widget around the search form's input control.
     *
     * @method _setupAutocomplete
     * @private
     *
     */
    _setupAutocomplete: function() {
      // Bind out helpers to the current objects context, not the auto
      // complete widget context..
      var fetchSuggestions = Y.bind(this._fetchSuggestions, this);
      var suggestFormatter = Y.bind(this._suggestFormatter, this);

      // Create our autocomplete instance with all the config and handlers it
      // needs to function properly.
      this.ac = new Y.AutoComplete({
        inputNode: this.get('boundingBox').one('input[name=bws-search]'),
        queryDelay: 150,
        resultFormatter: suggestFormatter,
        resultListLocator: 'result',
        'resultTextLocator': function(result) {
          return result.charm.name;
        },
        source: fetchSuggestions
      });
      this.ac.render();
    },

    /**
     * Handle selecting an AC suggestion and firing the correct events to
     * update the UI.
     *
     * @method _suggestionSelected
     * @param {Y.Event} ev The 'select' event from the AC widget.
     *
     */
    _suggestionSelected: function(ev) {
      // Make sure the input box is updated.
      var form = this.get('boundingBox').one('form');
      form.one('input').set('value', ev.result.text);

      var charm = ev.itemNode.one('a');
      var charmID = charm.getData('charmid');
      var change = {
        charmID: charmID
      };

      this.fire(this.EVT_SEARCH_CHANGED, {
        change: change,
        newVal: ev.result.text
      });
    },

    /**
     * Toggle the active state depending on the content in the search box.
     *
     * @method _toggleActive
     * @private
     *
     */
    _toggleActive: function() {
      var form = this.get('boundingBox').one('form'),
          value = form.one('input').get('value');

      if (value === '') {
        form.removeClass('active');
      }
      else {
        form.addClass('active');
      }
    },

    /**
     * bind the UI events to the DOM making up the widget control.
     *
     * @method bindUI
     *
     */
    bindUI: function() {
      var container = this.get('boundingBox');

      this.addEvent(
          container.one('form').on(
              'submit', this._handleSubmit, this)
      );
      this.addEvent(
          container.one('input').on(
              'focus', this._setActive, this)
      );
      this.addEvent(
          container.one('input').on(
              'blur', this._toggleActive, this)
      );

      this.addEvent(
          container.one('.browser-nav').delegate(
              'click',
              this._onHome,
              '.home',
              this)
      );
      this.addEvent(
          container.one('i').on(
              'mouseenter',
              function(ev) {
                // Change the icon to hover on mounseenter.
                ev.target.removeClass('home-icon');
                ev.target.addClass('home-icon-hover');
              }, this)
      );
      this.addEvent(
          container.one('i').on(
              'mouseleave',
              function(ev) {
                // Change the icon to back on mouseleave.
                ev.target.removeClass('home-icon-hover');
                ev.target.addClass('home-icon');
              }, this)
      );

      // Make sure the UI around the autocomplete search input is setup.
      if (window.flags.ac) {
        this._setupAutocomplete();

        // Override a couple of autocomplete events to help perform our
        // navigation correctly.
        // Block the links from the charm token from taking effect.
        this.addEvent(
            this.ac.get('boundingBox').delegate(
                'click',
                function(ev) {
                  ev.halt();
                },
                '.yui3-charmtoken a'
            )
        );
        this.addEvent(
            this.ac.on('select', this._suggestionSelected, this)
        );

      }
    },

    /**
     * Clean up instances of objects we create
     *
     * @method destroy
     *
     */
    destroy: function() {
      if (this.ac) {
        this.ac.destroy();
      }
    },

    /**
     * Generic initializer for the widget. Publish events we expose for
     * outside use.
     *
     * @method initializer
     * @param {Object} cfg configuration override object.
     *
     */
    initializer: function(cfg) {
      /*
       * Fires when the "Charm Browser" link is checked. Needs to communicate
       * with the parent view so that it can handle filters and the like. This
       * widget only needs to clear the search input box.
       *
       */
      this.publish(this.EVT_SEARCH_CHANGED);
      this.publish(this.EVT_SEARCH_GOHOME);
    },

    /**
     * Render all the things!
     *
     * @method renderUI
     *
     */
    renderUI: function() {
      var data = this.getAttrs();
      this.get('contentBox').setHTML(
          this.TEMPLATE(data)
      );

      // If there's an existing search term, make sure we toggle active.
      if (data.filters.text) {
        this._toggleActive();
      }
    },

    /**
     * Update the search input to contain the string passed. This is meant to
     * be used by outside links that want to perform a pre-canned search and
     * display results.
     *
     * @method update_search
     * @param {String} newval the sting to update the input to.
     *
     */
    updateSearch: function(newval) {
      var input = this.get('contentBox').one('input');
      input.focus();
      input.set('value', newval);
    },

    /**
     * Show the home icons to the user.
     *
     * @method showHome
     *
     */
    showHome: function() {
      var homeNode = this.get('contentBox').one('.browser-nav');
      homeNode.removeClass('hidden');
    },

    /**
     * Hide the home links from the user.
     *
     * @method hideHome
     *
     */
    hideHome: function() {
      var homeNode = this.get('contentBox').one('.browser-nav');
      homeNode.addClass('hidden');
    }

  }, {
    ATTRS: {
      /**
        @attribute autocompleteSource
        @default {undefined} The api point for fetching the suggestions.
        @type {Charmworld2}

      */
      autocompleteSource: {

      },

      autocompleteDataFormatter: {

      },

      /**
         @attribute filters
         @default {Object} text: ''
         @type {Object}

       */
      filters: {
        value: {
          text: ''
        }
      },

      /**
       * @attribute withHome
       * @default false
       * @type {Boolean}
       *
       */
      withHome: {
        value: false
      }
    }
  });

}, '0.1.0', {
  requires: [
    'autocomplete',
    'base',
    'browser-charm-token',
    'browser-filter-widget',
    'event',
    'event-delegate',
    'event-tracker',
    'event-mouseenter',
    'event-valuechange',
    'juju-templates',
    'juju-views',
    'widget'
  ]
});
