import '../extjs/resources/css/ext-all-gray.css';
import './css/style.css';
import './css/meringue.css';
import 'd2-analysis/css/ui/GridHeaders.css';

import isString from 'd2-utilizr/lib/isString';
import arrayFrom from 'd2-utilizr/lib/arrayFrom';
import arrayTo from 'd2-utilizr/lib/arrayTo';

import {api, pivot, manager, config, ui, init} from 'd2-analysis';

import { Layout } from './api/Layout';

import { LayoutWindow } from './ui/LayoutWindow';
import { OptionsWindow } from './ui/OptionsWindow';

// extend
api.Layout = Layout;

// references
var refs = {
    api,
    pivot
};

    // dimension config
var dimensionConfig = new config.DimensionConfig();
refs.dimensionConfig = dimensionConfig;

    // option config
var optionConfig = new config.OptionConfig();
refs.optionConfig = optionConfig;

    // period config
var periodConfig = new config.PeriodConfig();
refs.periodConfig = periodConfig;

    // ui config
var uiConfig = new config.UiConfig();
refs.uiConfig = uiConfig;

    // app manager
var appManager = new manager.AppManager();
refs.appManager = appManager;

    // calendar manager
var calendarManager = new manager.CalendarManager(refs);
refs.calendarManager = calendarManager;

    // request manager
var requestManager = new manager.RequestManager(refs);
refs.requestManager = requestManager;

    // i18n manager
var i18nManager = new manager.I18nManager(refs);
refs.i18nManager = i18nManager;

    // sessionstorage manager
var sessionStorageManager = new manager.SessionStorageManager(refs);
refs.sessionStorageManager = sessionStorageManager;

    // ui manager
var uiManager = new manager.UiManager(refs);
refs.uiManager = uiManager;

    // instance manager
var instanceManager = new manager.InstanceManager(refs);
refs.instanceManager = instanceManager;

    // table manager
var tableManager = new manager.TableManager(refs);
refs.tableManager = tableManager;

// dependencies

    // instance manager
uiManager.setInstanceManager(instanceManager);

    // i18n manager
dimensionConfig.setI18nManager(i18nManager);
optionConfig.setI18nManager(i18nManager);
periodConfig.setI18nManager(i18nManager);
uiManager.setI18nManager(i18nManager);

    // static
appManager.applyTo([].concat(arrayTo(api), arrayTo(pivot)));
instanceManager.applyTo(arrayTo(api));
uiManager.applyTo(arrayTo(api));
dimensionConfig.applyTo(arrayTo(pivot));
optionConfig.applyTo([].concat(arrayTo(api), arrayTo(pivot)));

// requests
var manifestReq = $.ajax({
    url: 'manifest.webapp',
    dataType: 'text',
    headers: {
        'Accept': 'text/plain; charset=utf-8'
    }
});

var systemInfoUrl = '/api/system/info.json';
var systemSettingsUrl = '/api/systemSettings.json?key=keyCalendar&key=keyDateFormat&key=keyAnalysisRelativePeriod&key=keyHideUnapprovedDataInAnalytics&key=keyAnalysisDigitGroupSeparator';
var userAccountUrl = '/api/me/user-account.json';

var systemInfoReq;
var systemSettingsReq;
var userAccountReq;

manifestReq.done(function(text) {
    appManager.manifest = JSON.parse(text);
    appManager.env = process.env.NODE_ENV;
    appManager.setAuth();
    systemInfoReq = $.getJSON(appManager.getPath() + systemInfoUrl);

systemInfoReq.done(function(systemInfo) {
    appManager.systemInfo = systemInfo;
    appManager.path = systemInfo.contextPath;
    systemSettingsReq = $.getJSON(appManager.getPath() + systemSettingsUrl);

systemSettingsReq.done(function(systemSettings) {
    appManager.systemSettings = systemSettings;
    userAccountReq = $.getJSON(appManager.getPath() + userAccountUrl);

userAccountReq.done(function(userAccount) {
    appManager.userAccount = userAccount;
    calendarManager.setBaseUrl(appManager.getPath());
    calendarManager.setDateFormat(appManager.getDateFormat());
    calendarManager.init(appManager.systemSettings.keyCalendar);

requestManager.add(new api.Request(init.i18nInit(refs)));
requestManager.add(new api.Request(init.authViewUnapprovedDataInit(refs)));
requestManager.add(new api.Request(init.rootNodesInit(refs)));
requestManager.add(new api.Request(init.organisationUnitLevelsInit(refs)));
requestManager.add(new api.Request(init.legendSetsInit(refs)));
requestManager.add(new api.Request(init.dimensionsInit(refs)));
requestManager.add(new api.Request(init.dataApprovalLevelsInit(refs)));

requestManager.set(initialize);
requestManager.run();

});});});});

function initialize() {

    var i18n = i18nManager.get();

    // app manager
    appManager.appName = 'Pivot Table';
    appManager.sessionName = 'table';

    // instance manager
    instanceManager.apiResource = 'reportTables';
    instanceManager.dataStatisticsEventType = 'REPORT_TABLE_VIEW';

    // ui manager
    uiManager.disableRightClick();

    uiManager.enableConfirmUnload();

    uiManager.setIntroHtml(function() {
        return '<div class="ns-viewport-text" style="padding:20px">' +
            '<h3>' + i18nManager.get('example1') + '</h3>' +
            '<div>- ' + i18nManager.get('example2') + '</div>' +
            '<div>- ' + i18nManager.get('example3') + '</div>' +
            '<div>- ' + i18nManager.get('example4') + '</div>' +
            '<h3 style="padding-top:20px">' + i18nManager.get('example5') + '</h3>' +
            '<div>- ' + i18nManager.get('example6') + '</div>' +
            '<div>- ' + i18nManager.get('example7') + '</div>' +
            '<div>- ' + i18nManager.get('example8') + '</div>' +
            '</div>';
    }());
    
    instanceManager.updateInterpretationFunction = function(interpretation){
    	//Generate reporttable for this interpretation
        var layout = instanceManager.getStateCurrent(); // just get layout from state instead of re-picking it from ui

        layout.setResponse(null); // clear the current data cache so it goes to the server with the new relativePeriodDate
        layout.relativePeriodDate = interpretation.created; // set this date on the layout object, not in extraOptions
        layout.interpretationId = interpretation.id;
        
        var actualName = layout.name;
        if (layout.name.indexOf('<span') != -1){
            actualName = layout.name.substring(0, layout.name.indexOf(' <span'))
        }
        layout.name = actualName + ' <span id="relativePeriodDateTitle">[' + manager.DateManager.getYYYYMMDD(interpretation.created, true) + ']</span>'; // just append to the name here

        instanceManager.getReport(layout, true);  // re-run
    };

    // instance manager
    instanceManager.setFn(function(layout) {
        var sortingId = layout.sorting ? layout.sorting.id : null,
            table;

        // get table
        var getTable = function() {
            var response = layout.getResponse();
            var colAxis = new pivot.TableAxis(layout, response, 'col');
            var rowAxis = new pivot.TableAxis(layout, response, 'row');
            return new pivot.Table(layout, response, colAxis, rowAxis);
        };

        // pre-sort if id
        if (sortingId && sortingId !== 'total') {
            layout.sort();
        }

        // table
        table = getTable();

        // sort if total
        if (sortingId && sortingId === 'total') {
            layout.sort(table);
            table = getTable();
        }

        // render
        uiManager.update(table.html);

        // events
        tableManager.setColumnHeaderMouseHandlers(layout, table);
        tableManager.setValueMouseHandlers(layout, table);

        // mask
        uiManager.unmask();

        // statistics
        instanceManager.postDataStatistics();
    });

    // windows
    uiManager.reg(LayoutWindow(refs), 'layoutWindow').hide();

    uiManager.reg(OptionsWindow(refs), 'optionsWindow').hide();

    uiManager.reg(ui.FavoriteWindow(refs), 'favoriteWindow').hide();

    // viewport
    var northRegion = uiManager.reg(ui.NorthRegion(refs), 'northRegion');
    
    var eastRegion = uiManager.reg(ui.EastRegion(refs), 'eastRegion');

    var defaultIntegrationButton = uiManager.reg(ui.IntegrationButton(refs, {
        isDefaultButton: true,
        btnText: i18n.table,
        btnIconCls: 'ns-button-icon-table'
    }), 'defaultIntegrationButton');

    var chartIntegrationButton = ui.IntegrationButton(refs, {
        objectName: 'chart',
        moduleName: 'dhis-web-visualizer',
        btnIconCls: 'ns-button-icon-chart',
        btnText: i18n.chart,
        menuItem1Text: i18n.go_to_charts,
        menuItem2Text: i18n.open_this_table_as_chart,
        menuItem3Text: i18n.open_last_chart
    });

    var mapIntegrationButton = ui.IntegrationButton(refs, {
        objectName: 'map',
        moduleName: 'dhis-web-mapping',
        btnIconCls: 'ns-button-icon-map',
        btnText: i18n.map,
        menuItem1Text: i18n.go_to_maps,
        menuItem2Text: i18n.open_this_table_as_map,
        menuItem3Text: i18n.open_last_map
    });

    // viewport
    uiManager.reg(ui.Viewport(refs, {
        northRegion: northRegion,
        eastRegion: eastRegion,
        integrationButtons: [
            defaultIntegrationButton,
            chartIntegrationButton,
            mapIntegrationButton
        ]
    }), 'viewport');
}

global.refs = refs;
