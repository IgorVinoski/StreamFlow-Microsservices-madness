Fork do repositório:
![alt text](report/image.png)

Subir serviços:
`sudo docker compose up --build`
![alt text](report/subindo_docker.png)


Ao consumir a roda health do gateway, está com erro:
`GET http://localhost:8080/health`
![alt text](report/gateway_error.png)

Esse erro é ocasionado pelo seguinte:

```js
  const allUp = Object.values(results).every(r => r.status === 'up');

```

Enquanto isso deveria ser "ok" e não "up", visto que os serviços retornam "ok".
Simplesmente alterando o código para:

```js
  const allUp = Object.values(results).every(r => r.status === 'ok');

```
O problema é resolvido

![alt text](report/gateway-ok.png)

Portanto, agora sim.
Os serviços estão rodando.


Autenticando, foi possível obter o token:

`POST http://localhost:8080/auth/login`

body:

```json
{
	"token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEiLCJyb2xlIjoiYWRtaW4iLCJuYW1lIjoiQW5hIFNpbHZhIiwiaWF0IjoxNzc3NDY2ODA0LCJleHAiOjE3Nzc0NzQwMDQsImlzcyI6InN0cmVhbWZsb3ctYXV0aCJ9.Lsg_xu1n4sux19l8x9d3Nv3gGmsBHC_yNL7wEIqLVo7ICK6cz01qqZw0NipSU7fJKSH6auv2xGTx_dwFja1myRROQxp4kF_iSLFi_kx29hdUHU1gc9AbZ_265AUYTSrVRTFGDPC0Ztnb4n41ewI6UUFRtnIfmpFgp9q3ObnGJ99wIQniUCzZ642lTjk7ePFMpUcp-SUvImENkUI8Z_7rtADVpweiR66zOnz0ZwYXmVkVX5vclbIgK49XyxFhAkYTmAjxJGzqjioXd6JXSShjV67oJ59BRpXeWOZkZrKovfbrdSGVcTqhXVyG40ZtOBl5wuDCqOBwJt5hFa7CTJ2kfQ",
	"user": {
		"id": "user_1",
		"name": "Ana Silva",
		"role": "admin"
	}
}
```

![alt text](report/auth_ok.png)


Cenário 1: Medir latência da cadeia síncrona 

`POST http://localhost:8080/api/streaming/play `

```json
{
	"sessionId": 6,
	"movie": "Interestelar",
	"status": "playing",
	"message": "Reprodução iniciada."
}
```

Retorno médio de 300ms

![alt text](report/cenario_1.png)

Enquanto, ao consumir apenas `GET http://localhost:8080/api/catalog`
O retorno é de 30ms.


![alt text](report/get-catalog-ok.png)


Cenário 2 Notification como ponto de falha
    Inicialmente, vamos aprar o serviço notification

`docker compose stop notification-service`
![alt text](report/parando-notification.png)


Depois, reproduzir um vídeo para ver o que acontece

![alt text](report/falha-ao-notificar-usuario.png)
```

,"remoteAddress":"172.18.0.9","remotePort":34624},"msg":"incoming request"}
streaming-service-1  | {"level":30,"time":1777472892103,"pid":1,"hostname":"4fec1bb66af7","movieId":2,"userId":"user_1","msg":"Iniciando fluxo de play..."}
streaming-service-1  | {"level":40,"time":1777472892120,"pid":1,"hostname":"4fec1bb66af7","err":{"type":"TypeError","message":"fetch failed: getaddrinfo EAI_AGAIN notification-service","stack":"TypeError: fetch failed\n    at node:internal/deps/undici/undici:14976:13\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async Object.<anonymous> (/app/index.js:90:5)\ncaused by: Error: getaddrinfo EAI_AGAIN notification-service\n    at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)"},"msg":"Falha ao enviar notificação"}
streaming-service-1  | {"level":30,"time":1777472892124,"pid":1,"hostname":"4fec1bb66af7","reqId":"req-5","res":{"statusCode":201},"responseTime":21.539079999551177,"msg":"request completed"}

```


Isso prova o "fail silencioso": o usuário recebe resposta de sucesso, mas a notificação falhou. O problema é que se o timeout fosse menor ou a falha fosse no catalog (não no notification), o Play inteiro falharia.


