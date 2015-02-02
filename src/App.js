var acceptedPointsData = [];
var acceptedCountData = [];
var app = null;
var showAssignedProgram = true;

Ext.define('CustomApp', {
    scopeType: 'release',
    extend: 'Rally.app.App',
    componentCls: 'app',
    itemId: 'burnupApp',

    items: [
        {
            xtype: 'rallyreleasecombobox',
            fieldLabel: 'Release',
            labelAlign: 'right',
            width: 300,
            itemId: 'rallyRelease',
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
        }
    ],

    // Called when the release combo box is ready or selected.  This triggers the bulding of the chart.
    setSelectedRelease: function(releaseCombo) {
        releaseCombo.setLoading(true);

        var releaseName = releaseCombo.getRecord().data.Name;

        this.defaultRelease = releaseName;
        this.createChart();
    },

//  launch: function() { }, // No launch function currently needed: createChart is triggered when a release is ready or selected

    // switch to app configuration from ui selection
    config: {

        defaultSettings : {
            releases                : "",
            epicIds                 : "",
            ignoreZeroValues        : true,
            PreliminaryEstimate     : false,
            StoryPoints             : true,
            StoryCount              : false,
            StoryPointsProjection   : true,
            StoryCountProjection    : false,
            AcceptedStoryPoints     : true,
            AcceptedStoryCount      : false,
            AcceptedPointsProjection: true,
            AcceptedCountProjection : false,
            FeatureCount            : false,
            FeatureCountCompleted   : false,
            HistoricalProjection    : false,
            RefinedEstimate : false
        }

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

    createChart: function() {
        if (!app) {
            app = this;
        }

        app.series			 = createSeriesArray();
        app.configReleases	 = app.getSetting("releases") || app.defaultRelease;
        app.ignoreZeroValues = app.getSetting("ignoreZeroValues");
        app.epicIds			 = app.getSetting("epicIds");

        if (app.configReleases === "") {
            this.resetChart("Please Configure this app by selecting Edit App Settings from Configure (gear) Menu");
            return;
        }

        var that = this;
        // get the project id.
        this.project = this.getContext().getProject().ObjectID;

        // get the release (if on a page scoped to the release)
        var tbName = getReleaseTimeBox(this);
        // release selected page will over-ride app config
        app.configReleases = tbName !== "" ? tbName : app.configReleases;

        var configs = [];

        // query for estimate values, releases and iterations.
        configs.push({ model : "PreliminaryEstimate",
                       fetch : ['Name','ObjectID','Value'],
                       filters : []
        });
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

            app.peRecords   = results[0];
            app.releases    = results[1];
            app.featureType = results[2][0].get("TypePath");
            app.milestones  = results[3];

            if (app.releases.length===0) {
                app.resetChart("No Releases found with this name: " + app.configReleases);

                return;
            }

            configs = [
                {
                    model  : "Iteration",
                    fetch  : ['Name', 'ObjectID', 'Project', 'StartDate', 'EndDate'],
                    filters: app.createIterationFilter(app.releases)
                }
            ];

            // get the iterations
            async.map( configs, app.wsapiQuery, function(err,results) {

                app.iterations = results[0];

                if (app.epicIds && app.epicIds.split(",")[0] !=="")
                    app.queryEpicFeatures();
                else
                    app.queryFeatures();

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

    resetChart: function(mesg) {
        var releaseCombo = app.down('#rallyRelease');

        releaseCombo.setLoading(false);

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

    queryFeatureSnapshots : function () {

        var ids = _.pluck(app.features, function(feature) { return feature.get("ObjectID");} );
        // var pes = _.pluck(app.features, function(feature) { return feature.get("PreliminaryEstimate");} );
        var extent = app.getReleaseExtent(app.releases);
        // console.log("ids",ids,pes);

        var storeConfig = {
            find : {
                // '_TypeHierarchy' : { "$in" : ["PortfolioItem/PIFTeam"] },
                'ObjectID' : { "$in" : ids },
                '_ValidTo' : { "$gte" : extent.isoStart }
            },
            autoLoad : true,
            pageSize:1000,
            limit: 'Infinity',
            fetch: ['_UnformattedID','ObjectID','_TypeHierarchy','PreliminaryEstimate', 'LeafStoryCount','LeafStoryPlanEstimateTotal','AcceptedLeafStoryPlanEstimateTotal','AcceptedLeafStoryCount','PercentDoneByStoryCount','RefinedEstimate'],
            hydrate: ['_TypeHierarchy']
        };

        storeConfig.listeners = {
            scope : this,
            load: function(store, snapshots, success) {
                console.log("Loaded:"+snapshots.length," Snapshots.");
                app.createChartData(snapshots);
            }
        };

        var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);
    },

    createChartData : function ( snapshots ) {

        var that		 = this;
        var lumenize	 = window.parent.Rally.data.lookback.Lumenize;
        var snapShotData = _.map(snapshots,function(d){return d.data;});
        var extent		 = app.getReleaseExtent(app.releases);
        var snaps		 = _.sortBy(snapShotData,"_UnformattedID");

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
            if ( app.getSetting(s.name)===true) {
                hcConfig.push({
                   name : s.description, type : s.display
                });
            }
        });
        var hc = lumenize.arrayOfMaps_To_HighChartsSeries(calculator.getResults().seriesData, hcConfig);

        this.showChart( trimHighChartsConfig(hc) );
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
    //                 canRemove: Plot line can be removed (temporarily) by clicking on it
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
    parsePlotLines: function(seriesDates, recordArray, dateField, plotLineStyle) {
        var yLabelOffset = 0;

        var plotlines = _.map(recordArray, function(record){
            var d = new Date(Date.parse(record.raw[dateField])).toISOString().split("T")[0];

            var color = plotLineStyle.color || record.get("DisplayColor") || "grey";
            var labelHTML = '<span style="font-family:Rally;color:' + color + '">8</span>'; // 8 is a downward pointing triangle in the Rally font
            var labelText = record.get("Name");

            var plotLineConfig = {
                dashStyle: "Dot",
                color: color,
                width: 1,
                value: _.indexOf(seriesDates,d)
            };

            if (plotLineStyle.showLabel) {
                    plotLineConfig.label = {
                    text: labelHTML + labelText,
                    rotation: 0,
                    verticalAlign: 'top',
                    y: yLabelOffset % 2*15,
                    x: -6,
                    textAlign: 'left',
                    useHTML: true
                };
                yLabelOffset++;
            }

            if (plotLineStyle.canRemove) {
                var name		 = record.get("Name");
                var plotLineId   = 'milestone-' + name;

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
        return plotlines;
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
    getPlotLines: function(seriesDates) {
        var app = this;

        // filter the iterations
        var start = new Date( Date.parse(seriesDates[0]));
        var end   = new Date( Date.parse(seriesDates[seriesDates.length-1]));

        var iterations = _.filter(this.iterations,function(i) { return i.get("EndDate") >= start && i.get("EndDate") <= end;});
            iterations = _.uniq(iterations ,function(i) { return i.get("Name");});

        var itPlotLines = this.parsePlotLines(seriesDates, iterations, 'EndDate',                { dashStyle: 'dot', color: 'grey'} );
        var rePlotLines = this.parsePlotLines(seriesDates, this.selectedReleases, 'ReleaseDate', { dashStyle: 'dot', color: 'grey'} );
        var miPlotLines = this.parsePlotLines(seriesDates, this.milestones, 'TargetDate',        { dashStyle: 'dash', width: 2, showLabel: true, canRemove: true } );

        return itPlotLines.concat(rePlotLines).concat(miPlotLines);
    },

    showChart : function(series) {
        var that = this;

        app.resetChart();

        // create plotlines
        var plotlines = this.getPlotLines(series[0].data);

        // set the tick interval
        var tickInterval = series[1].data.length <= (7*20) ? 7 : (series[1].data.length / 20);

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
                    text: 'Release Burnup',
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
                legend: { align: 'center', verticalAlign: 'bottom' }
            }
        });
        this.add(extChart);

        app.clearLoading();
    },

    // Even though we don't seem to set it explicitly, the chart is left with
    // the loading mask on.  This hack turns it off on most browsers.
    clearLoading: function() {
        chart = this.down("#chart1");

        var p = Ext.get(chart.id);
        elems = p.query("div.x-mask");

        _.each(elems, function(e) { e.remove(); });
        var elems = p.query("div.x-mask-msg");
        _.each(elems, function(e) { e.remove(); });
    }

});
