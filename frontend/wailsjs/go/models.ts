export namespace main {
	
	export class DeviceConfigResponse {
	    port: string;
	    baudRate: number;
	    configured: boolean;
	    config: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new DeviceConfigResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	        this.baudRate = source["baudRate"];
	        this.configured = source["configured"];
	        this.config = source["config"];
	    }
	}
	export class DeviceSummary {
	    port: string;
	    baudRate: number;
	    configured: boolean;
	    model: string;
	    sensorType: string;
	    deviceKey: string;
	    mac: string;
	    config: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new DeviceSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	        this.baudRate = source["baudRate"];
	        this.configured = source["configured"];
	        this.model = source["model"];
	        this.sensorType = source["sensorType"];
	        this.deviceKey = source["deviceKey"];
	        this.mac = source["mac"];
	        this.config = source["config"];
	    }
	}
	export class WriteConfigResponse {
	    status: string;
	    cmd: string;
	    configured: boolean;
	    restart: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WriteConfigResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.cmd = source["cmd"];
	        this.configured = source["configured"];
	        this.restart = source["restart"];
	    }
	}

}

