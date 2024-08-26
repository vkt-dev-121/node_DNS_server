const { UDPServer } = require('dns2')
const { Packet } = require('dns2')
const cache = {};

const server = new UDPServer({
    port: 5333,
    handle: (request,send,rinfo) => {
        const [question] = request.questions;
        const {name, type} = question;

        console.log(`Received query: ${name}. Type: ${Packet.TYPE[type]}`);

        handleDNSQuery(question
            .then(response => send(response))
            .catch(err => console.log(err))
        );
    }
});

server.on('listening', () => {
    console.log('DNS server is listening on port 5333')
});

server.on('err', (err) => {
    console.log('server error: ', err);
})

server.listen();

// handle DNS query
async function handleDNSQuery(question) {
    const {name, type} = question;

    // Check cache
    const cachedResponse = cache[name];
    if(cachedResponse && (cachedResponse.timestamp + cachedResponse.ttl * 1000) > Date.now()) {
        return cachedResponse.response
    }

    // Resolve DNS using external DNS server
    const address = await resolveDNS(name, type);
    const response = buildResponse(question, address)

    // cache the response
    cache[name] = {
        response,
        ttl: 300, // 5 minutes in seconds
        timestamp: Date.now()
    }

    return response;
}

function resolveDNS(name, type) {
    return new Promise((resolve,reject) => {
        dns2.resolve(name, {types: [type]})
              .then((result) => {
                const answers = result.answers.map(a => a.address);
                resolve(answers);
              })
              .catch(reject)
    })
}

function buildResponse(question, addresses) {
    const response = Packet.createResponseFromRequest(question);
    addresses.forEach((address) => {
        response.answers.push({
            name: question.name,
            type: question.type,
            class: Packet.CLASS.IN,
            ttl: 300,
        });

    });

    return response;
}