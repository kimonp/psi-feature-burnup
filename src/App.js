var app = null;

Ext.define('CustomApp', {
    scopeType: 'release',
    extend: 'Rally.app.App',
    componentCls: 'app',
    itemId: 'burnupApp',

    items: [
        {
            xtype: 'panel',
            itemId: 'topPanel',
            layout: { type: 'hbox', align: 'left' },

            items: [{
                xtype: 'rallyreleasecombobox',
                fieldLabel: 'Release:',
                labelAlign: 'right',
                margin: 8,
                width: 300,
                itemId: 'releaseCombo',
                listeners: {
                    ready: function () {
                        var app = this.up('#burnupApp');

                        app.setSelectedRelease(this);  // This is scoped to the the combobox object
                    },
                    select: function () {
                        var app = this.up('#burnupApp');

                        app.setSelectedRelease(this);  // This is scoped to the the combobox object
                    }
                }
            }, {
                xtype: 'rallybutton',
                itemId: 'selectBurnupLinesButton',
                labelAlign: 'right',
                margin: 8,
                text: "Burnup Display",
                menu: [
                    {
                        xtype: 'menucheckitem',
                        itemId: 'showP0s',
                        text: 'P0 Burnup Lines',
                        checked: false,
                        handler: function(checkbox, showLabels) {
                        	app.createAndShowBurnupChart();
                        }
                    }, {
                        xtype: 'menucheckitem',
                        itemId: 'showDefects',
                        text: 'Defect Burnup Lines',
                        checked: false,
                        handler: function(checkbox, showLabels) {
                        	app.createAndShowBurnupChart();
                        }
                    }, {
                        xtype: 'menucheckitem',
                        itemId: 'showProjections',
                        text: 'Completion Projection Lines',
                        checked: false,
                        handler: function(checkbox, showLabels) {
                        	app.createAndShowBurnupChart();
                        }
                    }, { xtype: 'menuseparator' }, {
                        xtype: 'menucheckitem',
                        itemId: 'milestoneLabels',
                        text: 'Milestone Labels',
                        checked: true,
                        handler: function(checkbox) {
                            var showLabels	= checkbox.checked;

                            app.removePlotLines('milestone');
                            app.addPlotLines('milestone', showLabels);
                        }
                    }, {
                        xtype: 'menucheckitem',
                        itemId: 'iterationLabels',
                        text: 'Iteration Labels',
                        checked: true,
                        handler: function(checkbox) {
                            app.removePlotLines('iterationStart');
                            app.addPlotLines('iterationStart');
                        }
                    }, {
                        xtype: 'menucheckitem',
                        itemId: 'iterationLines',
                        text: 'Iteration Lines',
                        checked: true,
                        handler: function(checkbox) {
                            app.removePlotLines('iterationStart');
                            app.removePlotLines('iterationEnd');

                            app.addPlotLines('iterationStart');
                            app.addPlotLines('iterationEnd');
                        }
                    }, { xtype: 'menuseparator' }, {
                        xtype: 'menucheckitem',
                        itemId: 'iterationOverlap',
                        text: 'Overlaping Iteration Dates',
                        checked: true,
                        handler: function(checkbox) {
                            app.removePlotLines('iterationEnd');
                            app.addPlotLines('iterationEnd');
                        }
                    }],
            }, {
                xtype: 'rallybutton',
                itemId: 'selectFeatureButton',
                labelAlign: 'right',
                margin: 8,
                text: "Burnup Components",
                listeners: {
                    menuhide: function(button, event, eOpts) {
                        app.displayFeatureSelection();
                    },
                    click: function(button, event, eOpts) {

                    	if (!app.featureRecords) {
                            var release = app.releases && app.releases[0];
                            var relName = release && release.get('Name');

                            button.menu.setLoading(true);

                            app.featureToNameMap = {};

                            var config = {
                                model  : app.featureType,
                                fetch  : ['Name', 'FormattedID',
                                          'LeafStoryPlanEstimateTotal','AcceptedLeafStoryPlanEstimateTotal'],
                                filters: [{
                                    property: 'Release.Name',
                                    operator: '=',
                                    value: relName
                                }]
                            };
                            app.wsapiQuery(config, function(err, featureRecords) {
                                // Sort by effort remaining to complete
                                featureRecords = _.sortBy(featureRecords, function(rec) {
                                        var tot		= rec.get('LeafStoryPlanEstimateTotal');
                                        var done	= rec.get('AcceptedLeafStoryPlanEstimateTotal');
                                        var rem		= tot - done;

                                        return -rem;
                                });

                                _(featureRecords).forEach(function(featureRecord) {
                                    var name 		= featureRecord.get('Name');
                                    var id	 		= featureRecord.get('FormattedID');
                                    var totalPoints = featureRecord.get('LeafStoryPlanEstimateTotal');
                                    var donePoints	= featureRecord.get('AcceptedLeafStoryPlanEstimateTotal');
                                    var remPoints	= totalPoints - donePoints;

                                    app.featureToNameMap[id] = name;

                                    button.menu.add({ text: '<b>' + id + '</b>: ' + name +
                               			' <span style="font-size:9px">(' +
                                    	remPoints + ': ' + donePoints + '/' + totalPoints + ')</span>',
                                    	xtype: 'menucheckitem', value: id, checked: true,
                                    	handler:  function(checkbox) {
                                            if (checkbox.checked) {
                                                app.setCheckbox('selectNone', false);
                                            } else {
                                                app.setCheckbox('selectAll', false);
                                            }
                                        }
                                	});
                                });

                                app.featureRecords = featureRecords;
                                button.menu.setLoading(false);
                            });
                    	}
                    }

                },

                menu: [
                       {
                           xtype: 'menucheckitem',
                           text: 'Select All',
                           itemId: 'selectAll',
                           checked: true,
                           handler: function(checkbox) {
                                var checked	= checkbox.checked;

                                if (checked) {
                                    app.setAllInSelectMenu(true);
                                }
                           }
                       }, {
                           xtype: 'menucheckitem',
                           text: 'Select None',
                           itemId: 'selectNone',
                           handler: function(checkbox) {
                                var checked	= checkbox.checked;

                                if (checked) {
                                    app.setAllInSelectMenu(false);
                                }
                           }
                       }, { xtype: 'menuseparator' }, {
                           xtype: 'menucheckitem',
                           text: 'Include Defects',
                           itemId: 'includeDefects',
                           handler: function(checkbox) {
                                var checked	= checkbox.checked;

                                if (checked) {
                                    app.setCheckbox('selectNone', false);
                                } else {
                                    app.setCheckbox('selectAll', false);
                                }
                           },
                           checked: true
                       }, { xtype: 'menuseparator' }
                ],
            },
           ]

        }, {
            xtype: 'panel',
            layout: 'fit',
            items: [
                {
                    xtype: 'panel',
                    itemId: 'chartPanel',
                    layout: 'fit',
                    minHeight: 500,
                    minWidth: 100
                }
            ]
        }, {
            xtype: 'panel',
            itemId: 'gridPanel',
            layout: { type: 'hbox', align: 'left' }
        }
    ],

    //
    // Once the user has changed the selection of burnup features and defects, display that
    //
    displayFeatureSelection: function() {
        var button				= app.down('#selectFeatureButton');
        var menuItems			= button.menu.items.items;
        var selectedFeatures	= [];
        var ignoredFeatures		= [];

        _(menuItems).forEach(function(menuItem) {
            if (menuItem.value && menuItem.checked) {
                selectedFeatures.push(menuItem.value);

            } else if (menuItem.value && !menuItem.checked) {
                ignoredFeatures.push(menuItem.value);
            }
        });

        app.selectedFeatures = selectedFeatures;
        app.ignoredFeatures	 = ignoredFeatures;

        app.createAndShowBurnupChart();
    },

    //
    // Feature selection is the widget that selects particular features to display in the burndown.
    // If it is null, then that means display all features in the release, which is the default display.
    //
    resetFeatureSelection: function () {
        this.selectedFeatures = null;
        this.ignoredFeatures = null;

        this.featureRecords = null;
    },

    allFeaturesSelected: function() {
        var button		= app.down('#selectFeatureButton');
    	var menu		= button.menu;
        var allSelected = true;

    	_(menu.items.items).forEach(function(menuItem) {
            if (menuItem.value && menuItem.checked == false) {
                allSelected = false;
            }
    	});

        return allSelected;
    },

    //
    // Check all the boxes in the feature select menu
    //
    setAllInSelectMenu: function(selectValue) {
        var button	= app.down('#selectFeatureButton');
    	var menu	= button.menu;

        // console.log(menu);

    	_(menu.items.items).forEach(function(menuItem) {
            var text = menuItem.text;

           //  console.log(text, menuItem);

            if (menuItem.xtype == 'menuseparator') {
                // Probably the separator

            } else if (text == 'Select None') {
                if (selectValue) {
                    menuItem.setChecked(false);
                }
            } else {
                menuItem.setChecked(selectValue);
            }
    	});
    },

    getCheckboxValue: function(checkBoxId) {
        var checkbox = this.down('#' + checkBoxId);

        // console.log(checkBoxId, checkbox);

        return checkbox.checked;
    },

    setCheckbox: function(checkBoxId, value) {
        var checkbox = this.down('#' + checkBoxId);

        checkbox.setChecked(value);
    },

    milestoneLabels: function() { return this.getCheckboxValue('milestoneLabels'); },
    iterationLabels: function() { return this.getCheckboxValue('iterationLabels'); },
    showP0s:		 function() { return this.getCheckboxValue('showP0s'); },
    showDefects:	 function() { return this.getCheckboxValue('showDefects'); },
    showProjections: function() { return this.getCheckboxValue('showProjections'); },
    onlyP0s:		 function() { return false; }, // Used to be a checkbox, but now since we have the P0 lines as well, no longer needed

    includeDefects:  function() { return this.getCheckboxValue('includeDefects'); }, // Don't include defects if we are  listing features

    // Called when the release combo box is ready or selected.  This triggers the building of the chart.
    setSelectedRelease: function(releaseCombo) {
        var releaseName = releaseCombo.getRecord().data.Name;
        this.defaultRelease = releaseName;

        this.resetFeatureSelection();

        this.resetData();
        this.createChart();
    },

	getTestPicker: function() {
		Ext.Loader.setConfig({ enabled: true });
		Ext.Loader.setPath('Ext.ux', '/ux');
		var store = Ext.create('Ext.data.Store', {
				fields: ['id', 'type'],
				data:
				[
					{id: '1', type: 'option one'},
					{id: '2', type: 'option two'},
					{id: '3', type: 'option three'},
					{id: '4', type: 'option four'},
					{id: '5', type: 'option five'},
					{id: '6', type: 'option six'},
					{id: '7', type: 'option seven'}
				]
			});

		return {
			xtype: 'rallymultiobjectpicker',
			fieldLabel: 'Include In Burnup:',
			labelAlign: 'right',
			rowSelectable: true,
			margin: 8,
			listCfg:  {selModel: {mode: 'SIMPLE'}, displayField: "type", pageSize: 0, autoScroll: true, cls: 'rui-multi-object-list'},
            store: store,
            /*
			storeConfig: {
				context: this._getScopeLimitedContext(),
				sorters: [{ // does not seem to work...
						property: 'ReleaseDate',
						direction: 'ASC'
					}],
				listeners: {
					load: setCheckboxesFromPrefs,
					scope: this
				}
			},
            */
			listeners: {
//				added:				function(picker) { this.releasePicker = picker; },
//				selectionchange:	recordSelectionAsReleaseFilters,
//				blur:				setCardboardFiltersFromPrefs,

				scope:				this
			},
//			modelType: 'release',
//			renderTo: Ext.getBody().dom
		};
	},

    launch: function() {
		this.velocityCalc = new VelocityCalculator(this);

        /*
        var picker = this.getTestPicker();
        var panel	= this.down('#topPanel');

        panel.add(picker);
        */
    }, // No launch function currently needed: createChart is triggered when a release is ready or selected

    // switch to app configuration from ui selection
    config: {
        defaultSettings : getDefaultSettings()
    },

    getSettingsFields: function() {

        var checkValues = _.map(createSeriesArray(),function(s) {
            return { name : s.name, xtype : 'rallycheckboxfield', label : s.description};
        });

        var values = [
            {
                name: 'releases',
                xtype: 'rallytextfield',
                label : "Release names to be included (comma seperated)"
            }, {
                name: 'epicIds',
                xtype: 'rallytextfield',
                label : "(Optional) List of Parent PortfolioItem (Epics) ids to filter Features by"
            }, {
                name: 'featureIds',
                xtype: 'rallytextfield',
                label : "(Optional) List of PortfolioItem ids to exclusively show"
            }, {
                name: 'ignoreZeroValues',
                xtype: 'rallycheckboxfield',
                label: 'For projection ignore zero values'
            }
        ];

        _.each(values,function(value){
            value.labelWidth = 250;
            value.labelAlign = 'left';
        });

        return values.concat(checkValues);
    },

    //
    // Check if the end data of a group if iterations overlaps the end date
    //
    iterationsDontOverlap: function(iterations) {
        var overlap	= true;
        var iter1 	= iterations[0];

        if (iter1 && iterations.length > 1) {
            var i;
            var iter1Name = iter1.get('Name');
            var iter2 = null;

            for (i = 1; i < iterations.length; i++) {
                var curName = iterations[i].get('Name');

                if (curName != iter1Name) {
                    iter2 = iterations[i];
                    break;
                };
            }

            if (iter1 && iter2) {
                var iter1End	= Ext.Date.format(iter1.get('EndDate'), 'Y-M-d');
                var iter2Start	= Ext.Date.format(iter2.get('StartDate'), 'Y-M-d');

                overlap = iter1End < iter2Start;
            }
        }

        return overlap;
    },

    createChart: function() {
        if (!app) {
            app = this;
        }
        app.setLoading(true);

        app.series           = createSeriesArray();
        app.configReleases   = app.getSetting("releases") || app.defaultRelease;
        app.ignoreZeroValues = app.getSetting("ignoreZeroValues");
        app.epicIds          = app.getSetting("epicIds");
//        app.featureIds       = app.getSetting("featureIds");

        if (app.configReleases === "") {
            this.resetChart("Please Configure this app by selecting Edit App Settings from Configure (gear) Menu");
            return;
        }

        // get the project id.
        this.project = this.getContext().getProject().ObjectID;

        // get the release (if on a page scoped to the release)
        var tbName = getReleaseTimeBox(this);
        // release selected page will over-ride app config
        app.configReleases = tbName !== "" ? tbName : app.configReleases;

        var configs = [];

        // query for estimate values, releases and iterations.
        configs.push({ model : "Release",
                       fetch : ['Name', 'ObjectID', 'Project', 'ReleaseStartDate', 'ReleaseDate' ],
                       filters: [app.createReleaseFilter(app.configReleases)]
        });
        configs.push({ model : "TypeDefinition",
                       fetch : true,
                       filters : [ { property:"Ordinal", operator:"=", value:0} ]
        });
        configs.push({ model : "Milestone",
                       fetch : ['Name', 'TargetDate', 'DisplayColor'],
                       filters : [
                                Ext.create('Rally.data.QueryFilter', { property:'Projects', operator: 'contains', value:'project/' + this.project }).or(
                                Ext.create('Rally.data.QueryFilter', { property:'TargetProject', operator: '=', value: null })).and(
                                Ext.create('Rally.data.QueryFilter', { property:'TargetDate', operator: '!=', value: null }))
                       ],
                       sorters: [{
                           property: 'TargetDate',
                           direction: 'DESC'
                       }]
        });

        // get the preliminary estimate type values, and the releases.
        async.map( configs, app.wsapiQuery, function(err,results) {

            app.releases    = results[0];
            app.featureType = results[1][0].get("TypePath");
            app.milestones  = results[2];

            if (app.releases.length === 0) {
                app.resetChart("No Releases found with this name: " + app.configReleases);

                return;
            }

            configs = [
                {
                    model  : "Iteration",
                    fetch  : ['Name', 'ObjectID', 'Project', 'StartDate', 'EndDate'],
                    filters: app.createIterationFilter(app.releases), // XXX app.Releases is an array!
                    sorters: [{
                       property: 'StartDate',
                       direction: 'ASC'
                    }]
                }
            ];

            // get the iterations
            async.map( configs, app.wsapiQuery, function(err,results) {
                var iterations = results[0];

                if (!app.iterations && app.iterationsDontOverlap(iterations)) {
                    app.setCheckbox('iterationOverlap', false);
                }
                app.iterations = iterations;

                var includeDefects = app.includeDefects();

                if ((includeDefects && app.defectSnapshots) || (!includeDefects && app.featureSnapshots)) {
                    app.createAndShowBurnupChart();

                } else {
                    app.queryFeatureSnapshots();

                    /* If we are not going to limit to particular ids, then this query is not necessary:
                     * we can just query for all PI's associated with a release
                    if (app.epicIds && app.epicIds.split(",")[0] !== "")
                        app.queryEpicFeatures();
                    else
                        app.queryFeatures();
                     */
                }

            });
        });
    },

    // remove leading and trailing spaces
    trimString : function (str) {
        return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    },

    // creates a filter to return all releases with a specified set of names
    createReleaseFilter : function(releaseNames) {

        var filter = null;

        _.each( releaseNames.split(","), function( releaseName, i ) {
            if (releaseName !== "") {
                var f = Ext.create('Rally.data.wsapi.Filter', {
                        property : 'Name', operator : '=', value : app.trimString(releaseName) }
                );
                filter = (i===0) ? f : filter.or(f);
            }
        });

        console.log("Release Filter:",filter.toString());
        return filter;

    },

    // Given several releases, find the earliest starting date and latest ending date of all of them
    // Then create a filter that matches any iterations whose end date is >= the earliest release starting date
    // and <= the latest release ending date
    createIterationFilter : function(releases) {

        var extent = app.getReleaseExtent(releases);

        var filter = Ext.create('Rally.data.wsapi.Filter', {
            property : 'EndDate', operator: ">=", value: extent.isoStart
        });

        filter = filter.and( Ext.create('Rally.data.wsapi.Filter', {
                property : 'EndDate', operator: "<=", value: extent.isoEnd
            })
        );

        return filter;
    },

    // Given several releases, find the earliest starting date and latest ending date of all of them
    getReleaseExtent : function( releases ) {

        var start = _.min(_.pluck(releases,function(r) { return r.get("ReleaseStartDate");}));
        var end   = _.max(_.pluck(releases,function(r) { return r.get("ReleaseDate");}));
        var isoStart  = Rally.util.DateTime.toIsoString(start, false);
        var isoEnd    = Rally.util.DateTime.toIsoString(end, false);

        return { start : start, end : end, isoStart : isoStart, isoEnd : isoEnd };

    },

    // generic function to perform a web services query
    wsapiQuery : function( config , callback ) {

        Ext.create('Rally.data.WsapiDataStore', {
            autoLoad : true,
            limit : "Infinity",
            model : config.model,
            fetch : config.fetch,
            filters : config.filters,
            listeners : {
                scope : this,
                load : function(store, data) {
                    callback(null,data);
                }
            },
            sorters: config.sorters
        });

    },

    resetData: function() {
        delete this.defectSnapshots;
        delete this.featureSnapshots;
    },

    resetChart: function(mesg) {
        app.setLoading(false);

        var chart = app.down("#chart1");
        if (chart !== null) {
            chart.removeAll();
        }


        if (mesg) {
            Rally.ui.notify.Notifier.show({message: mesg, color: 'red'});
        } else {
            Rally.ui.notify.Notifier.hide();
        }
    },

    // No longer used
    executeFeatureQuery: function(filter) {
        return Ext.create('Rally.data.WsapiDataStore', {
            autoLoad: true,
            model : app.featureType,
            limit : 'Infinity',
            fetch: ['ObjectID', 'FormattedID'],
            filters: [filter],
            listeners: {
                load: function(store, features) {
                    console.log("Loaded:"+features.length," Features.");

                    app.features = features;

                    if (app.features.length === 0) {
                        app.resetChart('No features found for this release');

                    } else {
                        app.queryFeatureSnapshots();
                    }
                }
            }
        });
    },

    // No longer used
    queryEpicFeatures : function() {
        var filter = null;
        var epicIds = app.epicIds.split(",");

        if (epicIds.length === 0) {
            app.resetChart("No epic id's specified");

            return;
        }

        _.each(epicIds, function( epicId, i) {
            var f = Ext.create('Rally.data.QueryFilter', {
                property: 'Parent.FormattedID',
                operator: '=',
                value: epicId
            });
            filter = i === 0 ? f : filter.or(f);
        });

        app.executeFeatureQuery(filter);
    },

    // No longer used
    queryFeatures : function() {
        var filter = null;
        var releaseNames = _.uniq(_.map(app.releases,function(r){ return r.get("Name");}));

        console.log("releaseNames", releaseNames);

        _.each( releaseNames , function( release, i ) {
            var f = Ext.create('Rally.data.QueryFilter', {
                property: 'Release.Name',
                operator: '=',
                value: release
            });
            filter = i === 0 ? f : filter.or(f);
        });

        app.executeFeatureQuery(filter);
    },

    //
    // User can choose to limit the feature ids
    // from which the burnup is created
    //
    getSpecificFeatureIds: function() {
        var features = !app.allFeaturesSelected() && app.selectedFeatures;

//        features = ['F1020'];

        return features;
    },

    getSnapshotFilters: function(type) {
        // var ids = _.pluck(app.features, function(feature) { return feature.get("ObjectID");} );
        // var pes = _.pluck(app.features, function(feature) { return feature.get("PreliminaryEstimate");} );
        // console.log("ids",ids,pes);

        var extent = app.getReleaseExtent(app.releases);
        var relIDs = _.map(app.releases, function (release) { return release.data.ObjectID; });
        var filters;

        if (type === 'defect') {
            filters = {
                '_TypeHierarchy': { "$in" : ["Defect"] },
                'Release':		  { "$in" : relIDs },
                'PlanEstimate':   { "$gt" : 0 },
                '_ValidTo':		  { "$gte" : extent.isoStart }
            };

        } else {
            filters = {
                    '_TypeHierarchy': { "$in" : [app.featureType] },
                    'Release': 		  { "$in" : relIDs },
                    '_ValidTo':	      { "$gte" : extent.isoStart }
                };


            // If the feature has chosen to view certain featureIDs, find those; otherwise get all associated with the
            // matching release Ids
            var featureIds = this.getSpecificFeatureIds();

            if (featureIds) {
                filters.FormattedID = { "$in" : featureIds };
            } else {
                filters.Release     = { "$in" : relIDs };
            }

            if (app.onlyP0s()) {
                filters.c_Priority = { "$in": ['P0']};
            }
        }

        return filters;
    },

    queryFeatureSnapshots : function () {
        var defectStoreFilters  = this.getSnapshotFilters('defect');

        var defectStoreConfig = {
            find: defectStoreFilters,
            autoLoad : true,
            pageSize: 1000,
            limit: 'Infinity',
            fetch: ['PlanEstimate', 'ScheduleState'],
            hydrate: ['ScheduleState'],
            listeners: {
                load: function(store, snapshots, success) {
                    if (snapshots) {
                        console.log("Loaded:"+snapshots.length," Defects snapshots", success);
                    }

                    if (success === false) {
                        Rally.ui.notify.Notifier.show({message: "Failed to load defect data"});
                    }
                    app.gotSnapshotData('defects', snapshots);
                }
            }
        };

        var featureStoreFilters = this.getSnapshotFilters('feature');
        var featureStoreConfig = {
            find : featureStoreFilters,
            autoLoad : true,
            pageSize:1000,
            limit: 'Infinity',
//            fetch: ['_UnformattedID','ObjectID','_TypeHierarchy','PreliminaryEstimate', 'LeafStoryCount','LeafStoryPlanEstimateTotal','AcceptedLeafStoryPlanEstimateTotal','AcceptedLeafStoryCount','PercentDoneByStoryCount','RefinedEstimate']
//            fetch: ['LeafStoryPlanEstimateTotal','AcceptedLeafStoryPlanEstimateTotal']
            fetch: ['LeafStoryPlanEstimateTotal','AcceptedLeafStoryPlanEstimateTotal', 'c_Priority', 'FormattedID'],
            hydrate: ['c_Priority']
        };

//        console.log('releases', _.map(app.releases, function (release) { return release.data.ObjectID; }));

        featureStoreConfig.listeners = {
            scope : this,
            load: function(store, snapshots, success) {
                console.log("Loaded:"+snapshots.length," Feature Snapshots.", success);

                if (success === false) {
                    Rally.ui.notify.Notifier.show({message: "Failed to load user story data"});
                }
                app.gotSnapshotData('features', snapshots);
            }
        };

        if (!this.featureSnapshots) {
            console.log("Querying for feature snapshots", featureStoreConfig.find);
            Ext.create('Rally.data.lookback.SnapshotStore', featureStoreConfig);
        }
        if (this.includeDefects()) {
            console.log("Querying for defects snapshots", defectStoreConfig.find);
            Ext.create('Rally.data.lookback.SnapshotStore', defectStoreConfig);
        }
    },

    //
    // Make defectsSnapshots look like feature Snapshots by populating "Total" fields
    // that our found in feature level portfolio items
    //
    normalizeDefectSnapshotData: function(defectSnapshots) {

        app.defectTotalPoints = 0;
        app.defectAcceptedPoints = 0;

        _(defectSnapshots).forEach(function(defect) {
            var planEstimate = defect.data.PlanEstimate;

            defect.data.LeafStoryPlanEstimateTotal = planEstimate;

            defect.data.c_Priority = 'P0'; // Defects all considered P0
            defect.data.c_Type = 'DEFECT'; // Identify as a defect

            app.defectTotalPoints += planEstimate;
            if (defect.data.ScheduleState === 'Accepted') {
                app.defectAcceptedPoints += planEstimate;
            }

            defect.data.AcceptedLeafStoryPlanEstimateTotal =
                defect.data.ScheduleState === 'Accepted' ? defect.data.PlanEstimate : 0;

            defect.data.c_AcceptedPlanEstimate =
                defect.data.ScheduleState === 'Accepted' ? defect.data.PlanEstimate : 0;
        });

        return defectSnapshots;
    },

    gotSnapshotData: function(type, snapshots) {
        if (type == 'defects') {
            app.defectSnapshots = app.normalizeDefectSnapshotData(snapshots);

        } else if (type == 'features') {
            app.featureSnapshots = snapshots;
        }

        // Make sure we have all the data needed before drawing the graph
        if ((!app.includeDefects() || app.defectSnapshots) && app.featureSnapshots) {
            app.createAndShowBurnupChart();
        }
    },

    getFilterIdMap: function() {
        var featureIds = this.getSpecificFeatureIds();
        var map		   = null;

        if (featureIds) {
            map = {};

            _(featureIds).forEach(function(fid) {
                map[fid] = 1;
            });
        }

        return map;
    },

    //
    // Filter snapShot data based on filterMap
    //
    // Any defects should be passed through-- those are filtered elsewhere.
    //
    filterSnapShotFeatureData: function (snapShotData) {
        var filterMap		= this.getFilterIdMap();
        var filteredData	= [];

        if (filterMap == null) {
            filteredData = snapShotData;

        } else {
            _(snapShotData).forEach(function(snapShot) {
                // If no FormattedID, then its a defect, and those if those are filtered earlier
            	// so just pass them through.
            	//
            	// If a formated ID, only let them through if they are listed in the filter map
            	//
                if (!snapShot.FormattedID || filterMap[snapShot.FormattedID]) {
                    filteredData.push(snapShot);
                }
            });
        }

        return filteredData;
    },

    createAndShowBurnupChart : function () {
//        console.log('createChart', app, app.featureSnapshots, app.defectSnapshots);
        var snapshots    = this.includeDefects() && app.defectSnapshots ?
                            app.featureSnapshots.concat(app.defectSnapshots) : app.featureSnapshots;
        var lumenize     = window.parent.Rally.data.lookback.Lumenize;
        var snapShotData = this.filterSnapShotFeatureData(_.map(snapshots,function(d){return d.data;}));
        var extent       = app.getReleaseExtent(app.releases);

        // can be used to 'knockout' holidays
        var holidays = [
            //{year: 2014, month: 1, day: 1}  // Made up holiday to test knockout
        ];

        var myCalc = Ext.create("MyBurnCalculator", {
            series : app.series,
            ignoreZeroValues : app.ignoreZeroValues,
            peRecords : app.peRecords
        });

        // calculator config
        var config = {
            deriveFieldsOnInput: myCalc.getDerivedFieldsOnInput(),
            metrics: myCalc.getMetrics(),
            summaryMetricsConfig: [],
            deriveFieldsAfterSummary: myCalc.getDerivedFieldsAfterSummary(),
            granularity: lumenize.Time.DAY,
            tz: 'America/Chicago',
            holidays: holidays,
            workDays: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday'
        };
        // release start and end dates
        var startOnISOString = new lumenize.Time(extent.start).getISOStringInTZ(config.tz);
        var upToDateISOString = new lumenize.Time(extent.end).getISOStringInTZ(config.tz);
        // create the calculator and add snapshots to it.
        calculator = new lumenize.TimeSeriesCalculator(config);
        calculator.addSnapshots(snapShotData, startOnISOString, upToDateISOString);

        // create a high charts series config object, used to get the hc series data
        var hcConfig = [{ name : "label" }];
        _.each( app.series, function(s) {
            if (app.getSetting(s.name) === true) {
                var desc = s.description;

                if (desc.match('P0') && !app.showP0s()) {
                    // skip
                } else if (desc.match('Defect') && !app.showDefects()) {
                    // skip

                } else if (desc.match('Projection') && !app.showProjections()) {
                    // skip
                } else {
                    hcConfig.push({
                       name : s.description, type : s.display
                    });
                }
            }
        });
        var seriesData = calculator.getResults().seriesData;
        var hc = lumenize.arrayOfMaps_To_HighChartsSeries(seriesData, hcConfig);

        this.showChart( trimHighChartsConfig(hc) );

        this.velocityCalc.addGrids(seriesData, app.milestones, app.iterations);
    },

    getChartXAxis: function() {
        var chart = app.down("highchart").chart;
        var xAxisArray = chart.xAxis;

        return xAxisArray[0];
    },

    removePlotLines: function(labelHead) {
        var xAxis		= this.getChartXAxis();
        var plotLines	= xAxis.plotLinesAndBands;
        var ids			= [];
            _(plotLines).forEach(function(plotLine) {
                if (plotLine && plotLine.id.match(labelHead + '-')) {
                    ids.push(plotLine.id);
                }
            });

        _(ids).forEach(function(id) {
            xAxis.removePlotLine(id);
        });
    },

    addPlotLines: function(plotLineType) {
        var showLabelTitles = plotLineType === 'milestone'
        					? this.getCheckboxValue('milestoneLabels')
        				    : this.getCheckboxValue('iterationLabels') && plotLineType == 'iterationStart';
        var xAxis			= this.getChartXAxis();
        var plotLines = plotLineType === 'milestone'
        				? this.getMilestonePlotLineConfigs(app.seriesDates, showLabelTitles)
        				: this.getIterationPlotLineConfigs(app.seriesDates, showLabelTitles, plotLineType);

        if (!plotLineType.match('iteration') || app.getCheckboxValue('iterationLines')) {
            _(plotLines).forEach(function(plotLine) {
                xAxis.addPlotLine(plotLine);
            });
        }
    },

    //
    // Return an array of plotlines.
    //
    //   seriesDates: An array of all the dates that will be displayed in the graph
    //   recordArray: An array of the record type we want to create plot lines for (release, iteration or milestone)
    //     dateField: The name of the field that accesses the "date" field for records in recordArray
    // plotLineStyle: Style of the plot line to be passed to highcharts.  Also contains several special fields that we interpret here
    //
    //                 showLabel: Label the plotline as the name of the record it represents (e.g. Milestone Name)
    //              plotLineType: 'milestone' and 'iterationStart' have special labels
    //							  'iterationEnd' has no labels
    //                     color: Enter an explit color, otherwise it will try to lookup the DisplayColor of the object (works for Milestones),
    //                            else it will default to grey
    //
    // showLabel notes:
    //
    // We want to display milestone plotLines similar to how they are displayed in the "Portfolio -> Timeline" page in Rally.
    // Those are just a dotted line with diamond at the top colored to match the color of the milestone.
    //
    // We could not find a way to display a diamond, but the character "8" in the Rally font is a downward pointing triangle/arrow
    // which is pretty close.  So we will display that in the color of the milestone.
    //
    getPlotLineConfigs: function(seriesDates, recordArray, dateField, plotLineStyle) {
        var plotLineCount	= 1;
        var plotLineType	= plotLineStyle.plotLineType || 'unknown';

        var plotLineConfigs = _.map(recordArray, function(record){
            var date = new Date(Date.parse(record.raw[dateField]));
                if (plotLineType == 'iterationEnd' && !app.getCheckboxValue('iterationOverlap')) {
					// For some groups interations start and end on the same day, but not all.
                    // So unfortunately this fix to avoid "double" iteration lines is not enough.

                    date.setDate(date.getDate() + 1);
                }
            var dateStr = date.toISOString().split("T")[0];

            var color = plotLineStyle.color || record.get("DisplayColor") || "grey";
            var labelHTML = '<span style="font-family:Rally;color:' + color + '">8</span>'; // 8 is a downward pointing triangle in the Rally font
            var labelTitle = record.get("Name");

            // We will show the plot line of the end date one day after the start

            var plotLineConfig = {
                dashStyle: "Dot",
                color: color,
                width: 1,
                value: _.indexOf(seriesDates, dateStr)
            };

            if (plotLineType == 'milestone') {
                var text = labelHTML;
                var yLabelOffset = -1;

                if (plotLineStyle.showLabelTitles) {
                    text += labelTitle;

                    if (plotLineCount % 2) {  // Every other title, move down one line, and right with non breaking spaces
//                        text += '<br><span>\u00A0\u00A0\u00A0</span>';  Does not work with IE
                        yLabelOffset = 15;
                    }
                }

                plotLineConfig.label = {
                    text: text,
                    rotation: 0,
                    verticalAlign: 'top',
                    x: -6,
                    y: yLabelOffset,
                    textAlign: 'left',
                    useHTML: true
                };
                plotLineCount++;

            } else if (plotLineType == 'iterationStart' && plotLineStyle.showLabelTitles) {
                plotLineConfig.label = {
                    text: labelTitle,
                    rotation: 270,
                    y: -5,
                    x: 10,
                    verticalAlign: 'bottom'
                };
            }

            if (plotLineType) {
                var name       = record.get("Name");
                var plotLineId = plotLineType + '-' + name;

                plotLineConfig.id = plotLineId;

                plotLineConfig.events = {
                    click: function () {
                        var axis        = this.axis;

                        axis.removePlotLine(plotLineId);
                    }/*,

                    mouseover: function () {
                        var axis        = this.axis;
                        var newPlotLine	= _.clone(plotLineConfig);
                        var oldLabel	= _.clone(this.label);
                        var labelRE		= new RegExp(labelText);

                        if (this.label.text.match(labelRE)) {
                            newPlotLine.label.text = labelHTML;

                        } else {
                            newPlotLine.label.text = labelHTML + labelText;
                        }

                        axis.removePlotLine(plotLineId);
                        axis.addPlotLine(newPlotLine);
                    },
                    mouseout: function () {
                    }*/
                };
            }

            _.each(plotLineStyle, function(value, key) {
                plotLineConfig[key] = value;
            }, this);


            return plotLineConfig;
        });
        return plotLineConfigs;
    },

    getMilestonePlotLineConfigs: function(seriesDates, showLabelTitles) {
        var plotLineStyle	= { dashStyle: 'dash', width: 2, showLabel: true, showLabelTitles: showLabelTitles, plotLineType: 'milestone'};

        return this.getPlotLineConfigs(seriesDates, this.milestones, 'TargetDate', plotLineStyle);
    },

    getIterationPlotLineConfigs: function(seriesDates, showLabelTitles, type) {
        var plotLineType	= type == 'iterationStart' ? 'iterationStart'	: 'iterationEnd';
        var dateField		= type == 'iterationStart' ? 'StartDate'		: 'EndDate';
        var start = new Date( Date.parse(seriesDates[0]));
        var end   = new Date( Date.parse(seriesDates[seriesDates.length-1]));

        var iterations = _.filter(this.iterations,function(i) { return i.get("EndDate") >= start && i.get("EndDate") <= end;});
            iterations = _.uniq(iterations ,function(i) { return i.get("Name");});

        var plotLineStyle	= { dashStyle: 'dot', color: 'grey', showLabelTitles: showLabelTitles, plotLineType:  plotLineType};

		return this.getPlotLineConfigs(seriesDates, iterations, dateField, plotLineStyle);
    },

    //
    // Given an array of all the dates plotted in the graph, return an array of plot lines.
    //
    // Plot lines are vertical lines that appear in the graph.  There are three types:
    //
    // * Iteration Plot lines: end dates of iterations
    // * Release Plot lines: stat and end dates of iteration
    // * Milestone Plot lines: target dates of milestones
    //
    // Iteration and Release plot lines are just a dotted grey lines.
    //
    // Milestone plot lines are thicker and colored to match the milestone, which a indicator at the top and
    // the name of the milestone displayed.
    //
    // Milestone plot lines can be temporarily removed from the graph by clicking on them.
    //
    getAllPlotLineConfigs: function(seriesDates) {
        var itLines		 = app.getCheckboxValue('iterationLines');
        var itPlotLines  = itLines ? this.getIterationPlotLineConfigs(seriesDates, this.iterationLabels(), 'iterationStart') : [];
        var itEPlotLines = itLines ? this.getIterationPlotLineConfigs(seriesDates, false, 'iterationEnd') : [];
        var rePlotLines  = this.getPlotLineConfigs(seriesDates, this.selectedReleases, 'ReleaseDate', { dashStyle: 'dot', color: 'grey'} );
        var miPlotLines  = this.getMilestonePlotLineConfigs(seriesDates, this.milestoneLabels());

        return itPlotLines.concat(itEPlotLines).concat(rePlotLines).concat(miPlotLines);
    },

    getChartTitle: function() {
        var title = '';

        var fids	= app.getSpecificFeatureIds();
        if (fids && fids.length == 0) {
          	if (this.includeDefects()) {
                title = 'Only showing Defects';
          	} else {
                title = 'No features or defects selected';
          	}

        } else if (fids) {
            var ignored = app.ignoredFeatures || [];

            if (fids.length <= ignored.length) {
                if (fids.length == 1) {
                    title = "Limited to feature " + fids[0] + ': ' + this.featureToNameMap[fids[0]];

                } else {
                    title = "Limited to features: " + fids.join(', ');
                }

              	if (this.includeDefects()) {
                    title += ' and Defects';
              	}
            } else {
                if (ignored.length == 1) {
                    title = "Excluding feature " + ignored[0] + ': ' + this.featureToNameMap[ignored[0]];
                } else {
                    title = "Excluding features: " + ignored.join(', ');
                }

              	if (!this.includeDefects()) {
                    title += ' and Defects';
              	}
            }

        } else {
          	if (!this.includeDefects()) {
                title += 'Not showing Defects';
          	}
        }

        // Because if we have no title, the spacing changes
        if (title == '') { title = ' '; }

        return title;
    },

    showChart : function(series) {
        app.resetChart();
        app.seriesDates = series[0].data;

        // create plotlines
        var plotlines = this.getAllPlotLineConfigs(app.seriesDates);

        // set the tick interval
        var tickInterval = series[1].data.length <= (7*20) ? 7 : (series[1].data.length / 20);
        var title	= this.getChartTitle();
        var extChart = Ext.create('Rally.ui.chart.Chart', {
            columnWidth : 1,
            itemId : "chart1",
            chartData: {
                categories : series[0].data,
                series : series.slice(1, series.length)
            },

            chartColors : createColorsArray(series),

            chartConfig : {
                chart: { },
                title: {
                    text: title,
                    x: -20 //center
                },
                plotOptions: {
                    series: {
                        marker: {
                            radius: 2
                        }
                    }
                },
                xAxis: {
                    plotLines : plotlines,
                    //tickInterval : 7,
                    tickInterval : tickInterval,
                    type: 'datetime',
                    labels: {
                        formatter: function() {
                            return Highcharts.dateFormat('%b %d', Date.parse(this.value));
                        }
                    }
                },
                yAxis: {
                    title: {
                        text : 'Points/Count'
                    },
                    plotLines: [{
                        value: 0,
                        width: 1,
                        color: '#808080'
                    }]
                },
                tooltip: {
                },
                legend: { align: 'center', verticalAlign: 'bottom' },
                renderTo: Ext.getBody()
            }
        });
//        var size = extChart.getSize();

        var panel = app.down('#chartPanel');
        panel.add(extChart);

        app.clearLoadingBug();
    },

    //
    // Even though we don't seem to set it explicitly, the chart is left with
    // the loading mask on.  This hack turns it off in FireFox and Explorer.
    //
    clearLoadingBug: function() {
//      chart = this.down("#chart1");
        var p = Ext.get(this.id);
        var elems = p.query("div.x-mask").concat(p.query("div.x-mask-msg"));

        _.each(elems, function(e) {
            if (typeof e.remove === 'function') {
                e.remove();

            } else if (typeof e.removeNode === 'function') {
                while (e.firstChild) {
                    e.removeChild(e.firstChild);
                }
                e.removeNode();
            }
        });
    }

});
