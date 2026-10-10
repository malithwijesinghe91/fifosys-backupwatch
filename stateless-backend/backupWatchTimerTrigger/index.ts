import { AzureFunction, Context } from "@azure/functions";
import { runPipeline } from "../backupWatchTrigger/index";
import { getTableClient } from "../shared/tableService";

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
    const timeStamp = new Date().toISOString();
    
    if (myTimer.isPastDue) {
        context.log.info('Timer function is running late!');
    }
    
    context.log.info(`BackupWatch Background Scanner Timer trigger function started at ${timeStamp}`);
    
    const formatUkTime = (dateInput: string | number | Date): string => {
        try {
            const d = new Date(dateInput);
            return d.toLocaleString("en-GB", { timeZone: "Europe/London" });
        } catch (e) {
            return new Date(dateInput).toLocaleString();
        }
    };

    // lastScan is the exact timestamp when this scan completes execution
    const lastScanRaw = new Date().toISOString();
    // nextScan is either myTimer.scheduleStatus.next or exact current time + 30 minutes
    let nextScanRaw = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    if (myTimer && myTimer.scheduleStatus && myTimer.scheduleStatus.next) {
        const schedNext = new Date(myTimer.scheduleStatus.next).getTime();
        // If the schedule status next time is in the past or equals current run time, project +30 mins
        if (schedNext <= Date.now()) {
            nextScanRaw = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        } else {
            nextScanRaw = myTimer.scheduleStatus.next;
        }
    }
    
    const lastScan = formatUkTime(lastScanRaw);
    const nextScan = formatUkTime(nextScanRaw);
    
    try {
        // Force refresh to bypass the 5-minute cache and perform a live scan/sync/auto-heal
        const result = await runPipeline(context, true, true);
        const count = result && result.devices ? result.devices.length : 0;
        context.log.info(`BackupWatch Background Scanner successfully executed and cached ${count} appliances.`);
        
        try {
            const statusClient = await getTableClient("ScanStatus");
            await statusClient.upsertEntity({
                partitionKey: "Status",
                rowKey: "BCDRScanner",
                lastScan: lastScan,
                nextScan: nextScan,
                status: "Success",
                errorMessage: "",
                updatedTime: new Date().toISOString()
            }, "Replace");
        } catch (dbErr: any) {
            context.log.error(`Failed to update scan status in Table Storage: ${dbErr.message || dbErr}`);
        }
    } catch (error: any) {
        context.log.error(`BackupWatch Background Scanner encountered an error: ${error.message || error}`);
        
        try {
            const statusClient = await getTableClient("ScanStatus");
            await statusClient.upsertEntity({
                partitionKey: "Status",
                rowKey: "BCDRScanner",
                lastScan: lastScan,
                nextScan: nextScan,
                status: "Failed",
                errorMessage: error.message || String(error),
                updatedTime: new Date().toISOString()
            }, "Replace");
        } catch (dbErr: any) {
            context.log.error(`Failed to log scan error status in Table Storage: ${dbErr.message || dbErr}`);
        }
    }
};

export default timerTrigger;
