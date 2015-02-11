Ext.define("VelocityCalculator", {
    app: null,

    constructor: function(theApp) {
        this.app = theApp;

        return this;
    },

    setMilestoneVelocityGrid: function(seriesData, milestones) {
        this.milestones = milestones;

        var items	= this.getMilestoneItems(seriesData);
        var store	= Ext.create('Ext.data.Store', {
            	storeId: 'milestoneVelocityStore',
            	fields: ['startName', 'endName', 'days', 'acceptVelocity', 'acceptDelta', 'scopeVelocity', 'scopeDelta', 'segmentVelPerMo', 'segmentVel'],
                data: { 'items': items },
                proxy: { type: 'memory', reader: { type: 'json', root: 'items' } }
            });
        console.log('store', store);

        var oldPanel  = this.app.down("#gridPanel");
        if (oldPanel !== null) {
            console.log('remove oldGrid', oldPanel);
            oldPanel.removeAll();
        }

        var statsGrid = Ext.create('Ext.grid.Panel', {
            title: 'Milestone Segment Velocities',
            itemId: 'statsGrid',
            store: store,
            columns: [
//                      { text: 'Start Milestone',   dataIndex: 'startName', flex: 1 },
                      { text: 'End Milestone',       dataIndex: 'endName', flex: 200, align: 'right' },
                      { text: 'Segment Velocity', dataIndex: 'segmentVel' },
                      { text: 'SV / Month', dataIndex: 'segmentVelPerMo' },
                      { text: 'Accepted Points',     dataIndex: 'acceptDelta', hidden: true},
                      { text: 'Scope Change',        dataIndex: 'scopeDelta', hidden: true }
            ],
            width: 400,
            renderTo: Ext.getBody()
        });

        var panel = this.app.down('#gridPanel');
        panel.add(statsGrid);
        panel.update();
    },

    //
    // Initialize the milestoneDates collection, used to calculate segment velocities
    // With the start end end date of the release
    //
    initializeMilestoneSegments:  function (seriesData) {
        var start		   = seriesData[0];
        var startDate	   = start.label;

        var end			   = seriesData[seriesData.length-1];
        var endDate		   = end.label;

        var milestoneDates = {};

    	milestoneDates[startDate] = {
                pointData: start,
                milestoneList:[{ Name: 'Start of Release' }]
    		};

    	milestoneDates[endDate] = {
                pointData: end,
                milestoneList:[{ Name: 'End of Release' }]
    		};
        milestoneDates[startDate].pointData.nextDate = endDate;

    	return milestoneDates;
    },

    // Populate milestoneSegments:
    //   keys are the dates of the milestones
    //   values are: the data that exists on the graph at that date (filled in later) and an array of Milestones for that date
    //
    populateMilestoneSegmentDates: function(seriesData) {
        var milestoneDates	= this.initializeMilestoneSegments(seriesData);
        var relStartDate 	= seriesData[0].label; // Date of the end of the release
        var end				= seriesData[seriesData.length-1];
        var relEndDate 		= end.label; // Date of the end of the release
        var today		   = Ext.Date.format(new Date(), 'Y-m-d');

        console.log('inital milestoneDates', milestoneDates);

        var that = this;
        var lastDate		= relStartDate; // Date of the last segment end as we step through them
        _.every( this.milestones.reverse(), function(milestone) {
            var data = milestone.raw;
            var date = data.TargetDate.replace(/T.*/, '');

            if (date > today) {
                data.Name = 'Today - ' + today;
            }

            if (date > relStartDate && date < relEndDate) {
                var dateInfo = milestoneDates[date];
                    if (!dateInfo) { dateInfo = milestoneDates[date] = { pointData: {}, milestoneList:[] }; }

                dateInfo.milestoneList.push(data);

                if (lastDate) {
                    milestoneDates[lastDate].pointData.nextDate = date;
                }
                lastDate = date;
            }

           	return !that.dateIsFuture(date); // Quit once we get past the current date
        });

        return milestoneDates;
    },

    getMilestoneItems: function(seriesData) {
        var items	 	= [];
        var that		= this;

        var milestoneDates = this.populateMilestoneSegmentDates(seriesData);
        var today		   = Ext.Date.format(new Date(), 'Y-m-d');
        var todayPointData = null;
        //
        // Step through the chart series data, and fill in the pointDate information into milestoneDates
        //
        _.each( seriesData, function(pointData) {
            var date		= pointData.label;
            var dateEntry	= milestoneDates[date];

            if (dateEntry) {
            	dateEntry.pointData = _.extend(dateEntry.pointData, pointData);
            }

            if (date == today) {
                todayPointData = pointData;
            }
        });

        //
        // Step through milestoneDates, and create a velocity entry each segment between
        // the Start of the release, each milestone and the end of the release or current date
        //
        _.each( milestoneDates, function(data, date) {
            var pointData = data.pointData;
            var nextDate  = pointData.nextDate;

            if (that.dateIsFuture(date)) {
            	// Skip stuff that has not yet happened

            } else if (nextDate) {
                var nextName	  = milestoneDates[nextDate].milestoneList[0].Name;
                var nextPointData = milestoneDates[nextDate].pointData;
                	if (nextDate > today && todayPointData) { // Truncate to today, if the segment ends after the current date
                        nextPointData = todayPointData;
                        nextDate = today;
                	}
                var acceptedDiff  = nextPointData['Accepted Points'] - pointData['Accepted Points'];
                var scopeDiff	  = nextPointData['Story Points'] - pointData['Story Points'];
                var days	  	  = that.subtractDates(nextDate, date);
                var months		  = days / 30;

                _.each( data.milestoneList, function(milestone, date) {
                    var name = milestone.Name;

                    if (!_.isNaN(acceptedDiff)) {
                        items.push({
                            startName:		name,
                            endName:		nextName + ' (' + days + ' days)',
                            days:			days,
                            segmentVel:		acceptedDiff - scopeDiff,
                            segmentVelPerMo:Math.round((acceptedDiff - scopeDiff)/months * 100) / 100,

                            acceptDelta:    that.velocityStr(acceptedDiff, months),
                            scopeDelta:     that.velocityStr(scopeDiff, months),
                            effectiveVel:   that.velocityStr(acceptedDiff - scopeDiff, months)
                        });
                    }
                });
            }
        });
        return items;
    },

    dateIsFuture: function(dateStr) {
        var date	= Ext.Date.parse(dateStr, 'Y-m-d');
        var today	= new Date();

        return date > today;
    },

    velocityStr: function(pointDelta, months) {
        var velocity	  = Math.round(pointDelta / months * 100) / 100 ;

        return pointDelta  + ' (' + velocity + '/mo)';
    },

    subtractDates: function(d1, d2) {
        var date1 = new Date(d1);
        var date2 = new Date(d2);
        var diff  = date1.getTime() - date2.getTime();

        return diff / (24*60*60*1000);
    }
});
