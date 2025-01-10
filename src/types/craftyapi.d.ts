export interface AuthLoginPost {
  status: "ok" | string;
  data: {
    token: string;
    user_id: string;
  };
}

export interface AllServersGet {
  status: "ok" | string;
  data: {
    server_id: number;
    created: string;
    server_uuid: string;
    server_name: string;
    path: string;
    backup_path: string;
    executable: string;
    log_path: string;
    execution_command: string;
    auto_start: boolean;
    auto_start_delay: number;
    crash_detection: boolean;
    stop_command: string;
    executable_update_url: string;
    server_ip: string;
    server_port: number;
    logs_delete_after: number;
    type: string;
  }[];
}

export interface ServerStatusGet {
  status: "ok" | string;
  data: {
    stats_id: number;
    created: string;
    server_id: {
      server_id: string;
      created: string;
      server_name: string;
      path: string;
      executable: string;
      log_path: string;
      execution_command: string;
      auto_start: boolean;
      auto_start_delay: number;
      crash_detection: boolean;
      stop_command: string;
      executable_update_url: string;
      server_ip: string;
      server_port: number;
      logs_delete_after: number;
      type: "minecraft-java" | "minecraft-bedrock";
      show_status: boolean;
      created_by: number;
      shutdown_timeout: number;
      ignored_exits: string;
      count_players: boolean;
    };
    started: string;
    running: boolean;
    cpu: number;
    mem: string;
    mem_percent: number;
    world_name: string;
    world_size: string;
    server_port: number;
    int_ping_results: string;
    online: number;
    max: number;
    players: `[${string}]`; // why did crafty do this
    desc: string;
    icon: string;
    version: string;
    updating: boolean;
    waiting_start: boolean;
    first_run: boolean;
    crashed: boolean;
    importing: boolean;
  };
}
