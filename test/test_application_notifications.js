'use strict';

describe('juju application notifications', function() {
  var Y, juju, models, views, applicationContainer, notificationsContainer,
      viewContainer, db, _setTimeout, _viewsHighlightRow, ERR_EV, NO_OP;

  function assertNotificationNumber(value) {
    assert.equal(
        applicationContainer.one('#notify-indicator').getHTML().trim(),
        value, 'The system didn\'t show the alert');
  }

  before(function() {
    Y = YUI(GlobalConfig).use([
      'juju-models',
      'juju-views',
      'juju-gui',
      'juju-env',
      'juju-tests-utils',
      'node-event-simulate'],
    function(Y) {
      juju = Y.namespace('juju');
      models = Y.namespace('juju.models');
      views = Y.namespace('juju.views');
    });

    ERR_EV = {
      err: true
    };
    NO_OP = function() {};
  });

  beforeEach(function() {
    applicationContainer = Y.Node.create('<div id="test-container" />');
    applicationContainer.appendTo(Y.one('body'));

    notificationsContainer = Y.Node.create('<div id="notifications" />');
    notificationsContainer.appendTo(applicationContainer);

    viewContainer = Y.Node.create('<div />');
    viewContainer.appendTo(applicationContainer);

    db = new models.Database();

    var notificationsView = new views.NotificationsView({
      container: notificationsContainer,
      app: {},
      env: {
        on: NO_OP,
        get: function(key) {
          if (key === 'connected') {
            return true;
          }
          return null;
        }
      },
      notifications: db.notifications
    });

    notificationsView.render();

    // The notifications.js delays the notification update.
    // We are going to avoid this timeout to make it possible to test
    // the notification callback synchronously.
    _setTimeout = window.setTimeout;
    window.setTimeout = function(callback) {
      callback();
    };

    // We skip this part because we have no row to highlight
    _viewsHighlightRow = views.highlightRow;
    views.highlightRow = NO_OP;

  });

  afterEach(function() {
    applicationContainer.remove(true);
    window.setTimeout = _setTimeout;
    views.highlightRow = _viewsHighlightRow;
  });

  it('should show notification for "add_unit" and "remove_units" exceptions' +
      ' (service view)', function() {
       var view = new views.service({
         container: viewContainer,
         app: {
           getModelURL: function() {
             return 'my url';
           }
         },
         db: db,
         env: {
           add_unit: function(serviceId, delta, callback) {
             callback(ERR_EV);
           },
           remove_units: function(param, callback) {
             callback(ERR_EV);
           }
         },
         model: {
           getAttrs: NO_OP,
           get: function(key) {
             if ('unit_count' === key) {
               // We simulate a model with 2 units
               return 2;
             }
             return null;
           }
         },
         querystring: {}
       }).render();

       db.units.get_units_for_service = function() {
         return [{
           id: 1
         }];
       };

       // It triggers the "add unit" logic
       view._modifyUnits(3);
       assertNotificationNumber('1');

       // It triggers the "remove unit" logic
       view._modifyUnits(1);
       assertNotificationNumber('2');
     });

  it('should show notification for "remove_units" and "resolved" exceptions' +
      ' (unit view)', function() {
       var view = new views.unit({
         container: viewContainer,
         app: {
           getModelURL: function() {
             return 'my url';
           }
         },
         db: db,
         env: {
           remove_units: function(param, callback) {
             callback({
               err: true,
               unit_names: ['aaa']
             });
           },
           resolved: function(unit_name, relation_name, retry, callback) {
             callback(ERR_EV);
           }
         },
         unit: {},
         querystring: {}
       });

       // Used by "unit.js" inside the "render" function
       db.services.getById = function() {
         // Mock service
         return {
           get: function(key) {
             if (key === 'loaded') {
               return true;
             }
             return null;
           }
         };
       };

       view.render();

       view.confirmRemoved({
         preventDefault: NO_OP
       });

       view.remove_panel.footerNode.one('.btn-danger').simulate('click');
       view.remove_panel.destroy();

       assertNotificationNumber('1');

       // Fake relation
       db.relations.getById = function() {
         return {name: ''};
       };

       view.retryRelation({
         preventDefault: NO_OP,

         // This is a mock object of the relation button
         target: {
           ancestor: function() {
             return {get: NO_OP};
           },
           set: NO_OP
         }
       });

       assertNotificationNumber('2');
     });

  it('should show notification for "add_relation" and "remove_relation"' +
      ' exceptions (environment view)', function() {
       var view = new views.environment({
         db: db,
         container: viewContainer}).render();

       view.service_click_actions._doAddRelationCallback.apply(view, [ERR_EV]);

       assertNotificationNumber('1');

       view._doRemoveRelationCallback.apply({
         scope: view,
         view: {
           removeSVGClass: NO_OP
         },
         confirmButton: {
           set: NO_OP
         }
       }, [ERR_EV]);

       assertNotificationNumber('2');
     });


  it('should show notification for "add_relation" and "destroy_service"' +
      ' exceptions (environment view)', function() {
       var view = new views.environment({
         db: db,
         destroy_service: {
           get: NO_OP
         },
         env: {
           destroy_service: function(service, callback) {
             callback(ERR_EV);
           }
         },
         container: viewContainer}).render();

       view.service_click_actions._doAddRelationCallback.apply(view, [ERR_EV]);

       assertNotificationNumber('1');

       view.service_click_actions.destroyService.apply(
           //destroyService function signature > (m, context, view, btn)
           view.service_click_actions, [{}, {}, view, {set: NO_OP}]);

       assertNotificationNumber('2');
     });

  it('should show notification for "get_service" exceptions' +
      ' (service constraints view)', function() {

       var view = new views.service_constraints({
         db: db,
         model: {
           getAttrs: NO_OP,
           get: function(key) {
             if ('constraints' === key) {
               return {};
             }
             return null;
           }
         },
         env: {
           set_constraints: function(id, values, callback) {
             callback(ERR_EV);
           }
         },
         container: viewContainer}).render();

       view.updateConstraints();

       assertNotificationNumber('1');
     });

  it('should show notification for "get_service", "expose" and "unexpose"' +
      ' exceptions (service config view)', function() {

       var view = new views.service_config({
         db: db,
         app: {
           getModelURL: NO_OP
         },
         model: {
           getAttrs: NO_OP,
           get: function(key) {
             if ('loaded' === key) {
               return true;
             }
             if ('config' === key) {
               return {};
             }
             return null;
           }
         },
         env: {
           set_config: function(id, newValues, callback) {
             callback(ERR_EV);
           },
           expose: function(id, callback) {
             callback(ERR_EV);
           },
           unexpose: function(id, callback) {
             callback(ERR_EV);
           }
         },
         container: viewContainer});

       db.charms.getById = function() {
         return {
           getAttrs: NO_OP,
           get: function(key) {
             if ('config' === key) {
               return {};
             }
             return null;
           }
         };
       };
       view.render();

       view.saveConfig();
       assertNotificationNumber('1');

       view.exposeService();
       assertNotificationNumber('2');

       view.unexposeService();
       assertNotificationNumber('3');
     });

  it('should show notification for "remove_relation"' +
      ' exceptions (service relations view)', function() {

       var view = new views.service_relations({
         db: db,
         app: {
           getModelURL: NO_OP
         },
         env: {
           remove_relation: function(id, newValues, callback) {
             callback(ERR_EV);
           }
         },
         container: viewContainer});

       db.relations.getById = function() {
         return {
           get: function(key) {
             if ('endpoints' === key) {
               return [
                       [{}, {name: ''}]
               ];
             }
             return null;
           }
         };
       };

       view.render();

       view.confirmRemoved({
         preventDefault: NO_OP,

         // This is a mock object of the relation button
         target: {
           ancestor: NO_OP,
           get: NO_OP
         }
       });
       view.remove_panel.footerNode.one('.btn-danger').simulate('click');
       view.remove_panel.destroy();

       assertNotificationNumber('1');
     });

});
