export interface AuthLoginPost {
  status: "ok" | string;
  data: {
    token: string;
    user_id: string;
  };
}

export interface AllServersGet {
  status: "ok" | string;
  data: [
    {
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
    }
  ];
}
